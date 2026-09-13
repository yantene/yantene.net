import type { IProfileQueryRepository, Profile } from "~/backend/domain/profile";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowsToProfile } from "./profile-row";
import { PROFILE_ID } from "~/backend/domain/profile";
import { profile, profileLifeEvents, profileSocials } from "~/backend/infra/d1/schema";

export class D1ProfileQueryRepository implements IProfileQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async find(): Promise<Profile | undefined> {
    const [row] = await this.db.select().from(profile).where(eq(profile.id, PROFILE_ID)).limit(1);
    if (row === undefined) return undefined;

    // 子は保存時に並べてあるので position の順に読めばよい。
    const [socialRows, eventRows] = await Promise.all([
      this.db
        .select()
        .from(profileSocials)
        .where(eq(profileSocials.profileId, PROFILE_ID))
        .orderBy(asc(profileSocials.position)),
      this.db
        .select()
        .from(profileLifeEvents)
        .where(eq(profileLifeEvents.profileId, PROFILE_ID))
        .orderBy(asc(profileLifeEvents.position)),
    ]);
    return rowsToProfile(row, socialRows, eventRows);
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
