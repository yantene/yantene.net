import type { HistoryEntry, IProfileQueryRepository, Profile } from "~/backend/domain/profile";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowsToHistory, rowsToProfile } from "./profile-row";
import { PROFILE_ID } from "~/backend/domain/profile";
import { profile, profileHistory, profileSocials } from "~/backend/infra/d1/schema";

export class D1ProfileQueryRepository implements IProfileQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async find(): Promise<Profile | undefined> {
    const [row] = await this.db.select().from(profile).where(eq(profile.id, PROFILE_ID)).limit(1);
    if (row === undefined) return undefined;

    // 子は保存時に並べてあるので position の順に読めばよい。
    const socialRows = await this.db
      .select()
      .from(profileSocials)
      .where(eq(profileSocials.profileId, PROFILE_ID))
      .orderBy(asc(profileSocials.position));
    return rowsToProfile(row, socialRows);
  }

  /**
   * 経歴だけを引く。`/about` だけが呼ぶ。
   *
   * ⚠️ **プロフィールの行が在るかは見ない。** 見ると `find` と合わせて 2 回引くことに
   * なり、読む口を分けた意味が薄れる。`profile_history` は `profile` が消えるときに
   * 一緒に消えるので、行が残っていれば親も在る。
   */
  async findHistory(): Promise<readonly HistoryEntry[]> {
    const historyRows = await this.db
      .select()
      .from(profileHistory)
      .where(eq(profileHistory.profileId, PROFILE_ID))
      .orderBy(asc(profileHistory.position));
    return rowsToHistory(historyRows);
  }

  async findSourceHash(): Promise<string | undefined> {
    const [row] = await this.db
      .select({ sourceHash: profile.sourceHash })
      .from(profile)
      .where(eq(profile.id, PROFILE_ID))
      .limit(1);
    return row?.sourceHash;
  }
}
