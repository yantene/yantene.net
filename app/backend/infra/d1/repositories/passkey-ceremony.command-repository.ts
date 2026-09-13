import { Temporal } from "@js-temporal/polyfill";
import { and, eq, gt, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  Challenge,
  IPasskeyCeremonyCommandRepository,
  PasskeyCeremony,
} from "~/backend/domain/admin";
import { CEREMONY_LIFETIME_SECONDS } from "~/backend/domain/admin";
import { passkeyCeremonies } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";

/**
 * 発行したチャレンジを D1 に置く実装 (ADR 0036)。
 *
 * KV ではなく D1 なのは、**引き当てと削除を 1 手で行いたい**ため。`DELETE ... RETURNING`
 * なら、同じ応答が同時に 2 回届いても行を取れるのは片方だけになる。
 */
export class D1PasskeyCeremonyCommandRepository implements IPasskeyCeremonyCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async issue(ceremony: PasskeyCeremony): Promise<void> {
    const now = instantToUnix(Temporal.Now.instant());

    // 期限切れを片付けてから入れる。KV と違って自動では消えないので、発行の
    // ついでに掃除する。**掃除を怠ると、誰でも叩ける口が置き場を増やし続ける。**
    await this.db.delete(passkeyCeremonies).where(lte(passkeyCeremonies.expiresAt, now));

    await this.db.insert(passkeyCeremonies).values({
      challenge: ceremony.challenge.toString(),
      purpose: ceremony.purpose,
      expiresAt: now + CEREMONY_LIFETIME_SECONDS,
    });
  }

  /**
   * 取り出して消す。
   *
   * 期限の判定も同じ `DELETE` の条件に入れる。読んでから判定すると、そのあいだに
   * 期限をまたいだ行を通してしまう。期限切れの行はここでは消さない (条件に合わない)
   * が、次の `issue` が掃除する。
   */
  async consume(challenge: Challenge): Promise<PasskeyCeremony | undefined> {
    const now = instantToUnix(Temporal.Now.instant());
    const rows = await this.db
      .delete(passkeyCeremonies)
      .where(
        and(
          eq(passkeyCeremonies.challenge, challenge.toString()),
          gt(passkeyCeremonies.expiresAt, now),
        ),
      )
      .returning({ purpose: passkeyCeremonies.purpose });

    const row = rows.at(0);
    if (row === undefined) return undefined;
    if (row.purpose !== "registration" && row.purpose !== "authentication") return undefined;
    return { challenge, purpose: row.purpose };
  }
}
