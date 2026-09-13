import { and, eq, gt, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Temporal } from "@js-temporal/polyfill";
import type {
  ConsumeSignInTokenOptions,
  ISignInTokenCommandRepository,
  IssueSignInTokenParams,
  SignInToken,
} from "~/backend/domain/auth";
import { EmailAddress, SIGN_IN_TOKEN_LIFETIME_MINUTES } from "~/backend/domain/auth";
import { signInTokens } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";
import { hashSignInToken } from "./sign-in-token-hash";

const SECONDS_PER_MINUTE = 60;

/**
 * 送ったマジックリンクを D1 に置く実装 (ADR 0039)。
 *
 * KV ではなく D1 なのは、**引き当てと削除を 1 手で行いたい**ため。
 * `DELETE ... RETURNING` なら、同じリンクが同時に 2 回踏まれても行を取れるのは
 * 片方だけになる。
 */
export class D1SignInTokenCommandRepository implements ISignInTokenCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async issue(params: IssueSignInTokenParams): Promise<void> {
    const now = instantToUnix(params.issuedAt);

    /*
     * 期限切れを片付けてから入れる。KV と違って自動では消えないので、発行のついでに
     * 掃除する。**掃除を怠ると、誰でも叩ける口が置き場を増やし続ける。**
     */
    await this.db.delete(signInTokens).where(lte(signInTokens.expiresAt, now));

    await this.db.insert(signInTokens).values({
      tokenHash: await hashSignInToken(params.token),
      email: params.email.toString(),
      requestId: params.requestId.toString(),
      expiresAt: now + SIGN_IN_TOKEN_LIFETIME_MINUTES * SECONDS_PER_MINUTE,
    });
  }

  /**
   * 取り出して消す。
   *
   * 期限の判定も同じ `DELETE` の条件に入れる。読んでから判定すると、そのあいだに
   * 期限をまたいだ行を通してしまう。期限切れの行はここでは消さない (条件に合わない)
   * が、次の `issue` が掃除する。
   *
   * `requestId` を渡したときは、**一致しなければ行を残す**。近道を外しただけなので、
   * 確認の画面からやり直せなければならない。
   */
  async consume(
    token: SignInToken,
    at: Temporal.Instant,
    options?: ConsumeSignInTokenOptions,
  ): Promise<EmailAddress | undefined> {
    const requestId = options?.requestId;
    const rows = await this.db
      .delete(signInTokens)
      .where(
        and(
          eq(signInTokens.tokenHash, await hashSignInToken(token)),
          gt(signInTokens.expiresAt, instantToUnix(at)),
          ...(requestId === undefined ? [] : [eq(signInTokens.requestId, requestId.toString())]),
        ),
      )
      .returning({ email: signInTokens.email });

    const row = rows.at(0);
    if (row === undefined) return undefined;

    /*
     * 置き場から戻した値でも読み直す。**読めなければ入れない** (fail-loud)。
     * ここを素通しすると、壊れた行がそのまま身元になる。
     */
    return EmailAddress.parse(row.email);
  }
}
