import { drizzle } from "drizzle-orm/d1";
import { PROFILE_ROW_ID, socialsToJson } from "./profile-row";
import type { IProfileCommandRepository, Profile } from "~/backend/domain/profile";
import { profile } from "~/backend/infra/d1/schema";
import { plainDateToIso } from "~/backend/infra/d1/temporal";

export class D1ProfileCommandRepository implements IProfileCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 固定の 1 行を upsert する。宛先を引数に取らないのは、行が 1 つしか無いため。
   */
  async save(entity: Profile): Promise<void> {
    const content = {
      name: entity.name.toString(),
      dateOfBirth: plainDateToIso(entity.dateOfBirth),
      birthplace: entity.birthplace ?? null,
      tagline: entity.tagline,
      socials: socialsToJson(entity.socials),
      sourceHash: entity.sourceHash,
    };

    await this.db
      .insert(profile)
      .values({ id: PROFILE_ROW_ID, ...content })
      .onConflictDoUpdate({ target: profile.id, set: content });
  }

  async delete(): Promise<void> {
    // 宛先を絞らない。行は 1 つしか無いので、消すことと空にすることが同じになる。
    await this.db.delete(profile);
  }
}
