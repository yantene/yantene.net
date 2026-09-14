import type { Profile, SocialLink } from "~/backend/domain/profile";

/** `/about` に出すプロフィール。エンティティをそのまま描画側へ渡さないための形。 */
export interface PublicProfile {
  readonly name: string;
  /** 生年月日 ("YYYY-MM-DD")。`<time dateTime>` にそのまま入れる。 */
  readonly dateOfBirth: string;
  readonly birthplace: string | null;
  /** 短い自己紹介。改行を含む (書いたとおりの行で出す)。 */
  readonly tagline: string;
  readonly socials: readonly SocialLink[];
}

export function toPublicProfile(profile: Profile): PublicProfile {
  return {
    name: profile.name.toJSON(),
    dateOfBirth: profile.dateOfBirth.toString({ calendarName: "never" }),
    birthplace: profile.birthplace ?? null,
    tagline: profile.tagline,
    socials: profile.socials,
  };
}
