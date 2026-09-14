import type { Profile } from "~/backend/domain/profile";
import type { SocialPlatform } from "~/lib/social-platforms";

export interface PublicSocialAccount {
  readonly platform: SocialPlatform;
  readonly url: string;
  /** 自分のアカウントだと主張する (`rel="me"` を出す) かどうか。 */
  readonly isMe: boolean;
}

/**
 * 3 か所 (トップのヒーロー・記事の末尾・`/about`) が共通で出すプロフィール。
 *
 * 長い自己紹介 (MDAST) はここに含めない。読むのは `/about` だけなので、記事を 1 本
 * 開くたびに運ぶ理由が無い。
 */
export interface PublicProfile {
  readonly name: string;
  /** 短い自己紹介。行に分けてある (描画側が改行を保ったまま 1 つの段落に流す)。 */
  readonly tagline: readonly string[];
  /** 生年月日 ("YYYY-MM-DD")。`<time dateTime>` にそのまま入れる。書いていなければ null。 */
  readonly dateOfBirth: string | null;
  readonly birthplace: string | null;
  readonly socials: readonly PublicSocialAccount[];
}

export function toPublicProfile(profile: Profile): PublicProfile {
  return {
    name: profile.name.toJSON(),
    tagline: profile.tagline.lines(),
    dateOfBirth: profile.dateOfBirth?.toString({ calendarName: "never" }) ?? null,
    birthplace: profile.birthplace ?? null,
    socials: profile.socials.map((social) => ({
      platform: social.platform,
      url: social.url,
      isMe: social.isMe,
    })),
  };
}
