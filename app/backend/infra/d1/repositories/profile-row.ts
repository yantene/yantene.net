import type { profile } from "~/backend/infra/d1/schema";
import type { SocialLink } from "~/backend/domain/profile";
import { isSocialPlatform, Profile, ProfileName } from "~/backend/domain/profile";
import { isoToPlainDate } from "~/backend/infra/d1/temporal";

/** 行は 1 つだけ。列に CHECK も置いてある (schema/profile.ts)。 */
export const PROFILE_ROW_ID = 1;

/**
 * D1 の行を Profile エンティティに復元する。Command / Query リポジトリで共有する。
 *
 * 名前・日付・出ていく先は保存時に検証済みなので、ここでの再検証は破損データの検知を
 * 兼ねる (不正なら throw する)。黙って落とすと、プロフィールが欠けた `/about` が
 * 正常な画面として出てしまう。
 */
export function rowToProfile(row: typeof profile.$inferSelect): Profile {
  return Profile.create({
    name: ProfileName.create(row.name),
    dateOfBirth: isoToPlainDate(row.dateOfBirth),
    birthplace: row.birthplace ?? undefined,
    tagline: row.tagline,
    socials: parseSocials(row.socials),
    sourceHash: row.sourceHash,
  });
}

/** 出ていく先を JSON 文字列に畳む。列に入れる形はここだけが知っている。 */
export function socialsToJson(socials: readonly SocialLink[]): string {
  return JSON.stringify(socials);
}

/**
 * 保存された出ていく先を読む。列は text なので、読めない中身は破損として扱う。
 *
 * 読める項目だけを拾う作りにしない。**知らない platform は同期の時点で弾いてある**
 * ので、ここに来て読めないのは行が壊れているときだけで、そのときに数が減った並びを
 * 返すと、壊れていることが表に出ない (fail-loud)。
 */
function parseSocials(value: string): readonly SocialLink[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error(`profile.socials is not an array: ${value}`);
  }
  return parsed.map((entry) => toSocialLink(entry));
}

function toSocialLink(entry: unknown): SocialLink {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`profile.socials has a non-object entry: ${JSON.stringify(entry)}`);
  }
  const { platform, url, isMe } = entry as Record<string, unknown>;
  if (typeof platform !== "string" || !isSocialPlatform(platform)) {
    throw new Error(`profile.socials has an unknown platform: ${JSON.stringify(platform)}`);
  }
  if (typeof url !== "string" || url.length === 0) {
    throw new Error(`profile.socials has an unreadable url: ${JSON.stringify(url)}`);
  }
  return { platform, url, isMe: isMe === true };
}
