import { drizzle } from "drizzle-orm/d1";
import { rowToProfile } from "./profile-row";
import type { IProfileQueryRepository, Profile } from "~/backend/domain/profile";
import { profile } from "~/backend/infra/d1/schema";

export class D1ProfileQueryRepository implements IProfileQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async find(): Promise<Profile | undefined> {
    const [row] = await this.db.select().from(profile).limit(1);
    return row === undefined ? undefined : rowToProfile(row);
  }

  /**
   * 変更検出のためだけに引く。本文の復元 (出ていく先の JSON の検査) を通らないので、
   * 行が壊れていても refresh はハッシュを比べられる。
   */
  async findSourceHash(): Promise<string | undefined> {
    const [row] = await this.db.select({ sourceHash: profile.sourceHash }).from(profile).limit(1);
    return row?.sourceHash;
  }
}
