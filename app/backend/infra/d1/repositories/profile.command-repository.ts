import type { HistoryEntry, IProfileCommandRepository, Profile } from "~/backend/domain/profile";
import type { IUnpersisted } from "~/backend/domain/shared";
import { Temporal } from "@js-temporal/polyfill";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { PROFILE_ID } from "~/backend/domain/profile";
import { profile, profileHistory, profileSocials } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";

/*
 * 1 文あたりの行数。**D1 のバインドパラメータ上限 (100) に収まる数で切る。**
 *
 * 欄の数がそのまま 1 行あたりのパラメータ数になる (出ていく先は 5、経歴は 12)。
 *
 * ⚠️ **手元のテストでは踏めない。** `createTestD1` は node:sqlite で、あちらの上限は
 * 32766 なので何行でも通る。超えたときに落ちるのは insert 1 文ではなく **batch ごと**で、
 * そうなると経歴だけでなく**プロフィールの同期まるごと**が止まる (名前も短い自己紹介も
 * 出ていく先も書き換わらない)。staging と production でしか出ない壊れ方なので、
 * 行数で切ることのほうを既定にする (`article-embedding.command-repository.ts` と同じ手)。
 */
export const SOCIAL_ROWS_PER_STATEMENT = 16;
export const HISTORY_ROWS_PER_STATEMENT = 8;

/** D1 が 1 文に受けるバインドパラメータの数。 */
export const D1_BOUND_PARAMETER_LIMIT = 100;

/** 行を `size` ごとの塊に分ける。空の入力からは 1 文も作らない。 */
function chunk<T>(rows: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_unused, index) =>
    rows.slice(index * size, (index + 1) * size),
  );
}

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
   *
   * ⚠️ **子の insert は行数で切って複数文にする** (D1 のバインドパラメータ上限)。
   * 1 文にまとめると、経歴が 15 件目に達した push で batch ごと落ちる。
   */
  async upsert(source: Profile<IUnpersisted>, history: readonly HistoryEntry[]): Promise<void> {
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

    /*
     * 経歴も同じ形で入れ直す。**章ごとに畳まずに平らな並びで置く。** 書いた順が
     * `position` に残っていれば、章に畳み直すのは読み出した側でできる。
     *
     * 書いていない欄は null にする。空文字で埋めると「補足があって中身が空」の行に
     * なり、描く側が空の段落を出す。
     */
    const historyRows = history.map((entry, position) => ({
      profileId: PROFILE_ID,
      position,
      chapter: entry.chapter,
      year: entry.date.year,
      month: entry.date.month ?? null,
      day: entry.date.day ?? null,
      endYear: entry.until?.year ?? null,
      endMonth: entry.until?.month ?? null,
      endDay: entry.until?.day ?? null,
      text: entry.text,
      url: entry.url ?? null,
      note: entry.note ?? null,
    }));

    await this.db.batch([
      this.db
        .insert(profile)
        .values({ id: PROFILE_ID, createdAt: nowUnix, ...content })
        .onConflictDoUpdate({ target: profile.id, set: content }),
      this.db.delete(profileSocials).where(eq(profileSocials.profileId, PROFILE_ID)),
      ...chunk(socialRows, SOCIAL_ROWS_PER_STATEMENT).map((rows) =>
        this.db.insert(profileSocials).values(rows),
      ),
      this.db.delete(profileHistory).where(eq(profileHistory.profileId, PROFILE_ID)),
      ...chunk(historyRows, HISTORY_ROWS_PER_STATEMENT).map((rows) =>
        this.db.insert(profileHistory).values(rows),
      ),
    ]);
  }

  /** 子テーブルは FK cascade だが D1 は FK 強制が既定で無効なため明示的に掃除する。 */
  async delete(): Promise<void> {
    await this.db.batch([
      this.db.delete(profileSocials).where(eq(profileSocials.profileId, PROFILE_ID)),
      this.db.delete(profileHistory).where(eq(profileHistory.profileId, PROFILE_ID)),
      this.db.delete(profile).where(eq(profile.id, PROFILE_ID)),
    ]);
  }
}
