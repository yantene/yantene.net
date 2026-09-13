import { and, count, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Temporal } from "@js-temporal/polyfill";
import type { EmailAddress, ISignInTokenQueryRepository } from "~/backend/domain/auth";
import { signInTokens } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";

export class D1SignInTokenQueryRepository implements ISignInTokenQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * そのアドレス宛に生きているリンクの本数。
   *
   * 受信箱を埋めさせないための上限に使う。期限が切れた行は数えないので、窓は
   * トークンの寿命 (15 分) と同じになる。
   */
  async countLiveFor(email: EmailAddress, at: Temporal.Instant): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(signInTokens)
      .where(
        and(
          eq(signInTokens.email, email.toString()),
          gt(signInTokens.expiresAt, instantToUnix(at)),
        ),
      );

    return rows.at(0)?.value ?? 0;
  }
}
