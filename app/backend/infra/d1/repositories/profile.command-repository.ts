import type { IProfileCommandRepository, Profile } from "~/backend/domain/profile";
import type { IUnpersisted } from "~/backend/domain/shared";
import { Temporal } from "@js-temporal/polyfill";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { PROFILE_ID } from "~/backend/domain/profile";
import { profile, profileSocials } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";

export class D1ProfileCommandRepository implements IProfileCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 固定の主キーで upsert する。子の行は差分を取らずに消してから入れ直す。
   *
   * 消してから入れるところまでを 1 つの batch にまとめる。D1 の batch は暗黙の
   * トランザクションなので、途中で落ちても「名前はあるのに出ていく先が空」の姿は
   * 表に出ない。
   */
  async upsert(source: Profile<IUnpersisted>): Promise<void> {
    const nowUnix = instantToUnix(Temporal.Now.instant());
    const content = {
      name: source.name.toString(),
      tagline: source.tagline.toString(),
      sourceHash: source.sourceHash,
      updatedAt: nowUnix,
    };

    const socialRows = source.socials.map((social, position) => ({
      profileId: PROFILE_ID,
      position,
      platform: social.platform,
      url: social.url,
      isMe: social.isMe,
    }));

    await this.db.batch([
      this.db
        .insert(profile)
        .values({ id: PROFILE_ID, createdAt: nowUnix, ...content })
        .onConflictDoUpdate({ target: profile.id, set: content }),
      this.db.delete(profileSocials).where(eq(profileSocials.profileId, PROFILE_ID)),
      ...(socialRows.length > 0 ? [this.db.insert(profileSocials).values(socialRows)] : []),
    ]);
  }

  /** 子テーブルは FK cascade だが D1 は FK 強制が既定で無効なため明示的に掃除する。 */
  async delete(): Promise<void> {
    await this.db.batch([
      this.db.delete(profileSocials).where(eq(profileSocials.profileId, PROFILE_ID)),
      this.db.delete(profile).where(eq(profile.id, PROFILE_ID)),
    ]);
  }
}
