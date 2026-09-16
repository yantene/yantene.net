import type { IProfileQueryRepository, Profile } from "~/backend/domain/profile";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowsToProfile } from "./profile-row";
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

    /*
     * 子は保存時に並べてあるので position の順に読めばよい。
     *
     * 2 つを並べて読むのは、ここがトップと**全記事ページ**の経路にあるため。順に
     * await すると、経歴を足したぶんだけ記事ページの応答が遅くなる。
     */
    const [socialRows, historyRows] = await Promise.all([
      this.db
        .select()
        .from(profileSocials)
        .where(eq(profileSocials.profileId, PROFILE_ID))
        .orderBy(asc(profileSocials.position)),
      this.db
        .select()
        .from(profileHistory)
        .where(eq(profileHistory.profileId, PROFILE_ID))
        .orderBy(asc(profileHistory.position)),
    ]);
    return rowsToProfile(row, socialRows, historyRows);
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
