import type { LifeEventPrecision, Profile } from "~/backend/domain/profile";
import type { SocialPlatform } from "~/lib/social-platforms";

export interface PublicSocialAccount {
  readonly platform: SocialPlatform;
  readonly url: string;
  /** 自分のアカウントだと主張する (`rel="me"` を出す) かどうか。 */
  readonly isMe: boolean;
}

export interface PublicLifeEvent {
  /**
   * 書かれたままの日付 (`1993-11-18` / `2012-04` / `2012`)。
   * `<time dateTime>` にはこれを入れる (HTML は年だけ・月までの形も許す)。
   */
  readonly date: string;
  readonly precision: LifeEventPrecision;
  readonly kind: string;
  readonly title: string;
  readonly description: string | null;
}

/**
 * 3 か所 (トップのヒーロー・記事の末尾・`/about`) が共通で出すプロフィール。
 *
 * 長い自己紹介 (MDAST) とライフイベントはここに含めない。読むのは `/about` だけなので、
 * 記事を 1 本開くたびに**描画側へ運ぶ**理由が無い。ただし D1 からはまとめて読んでいる
 * (`find()` は子表も引く)。ライフイベントが増えて重くなったら、要る列だけを引く
 * 読み口をリポジトリに足すことになる。
 */
export interface PublicProfile {
  readonly name: string;
  /** 短い自己紹介。行に分けてある (描画側が改行を保ったまま 1 つの段落に流す)。 */
  readonly tagline: readonly string[];
  readonly avatarUrl: string | null;
  readonly socials: readonly PublicSocialAccount[];
}

export function toPublicProfile(profile: Profile): PublicProfile {
  return {
    name: profile.name.toJSON(),
    tagline: profile.tagline.lines(),
    avatarUrl: profile.avatarUrl?.toJSON() ?? null,
    socials: profile.socials.map((social) => ({
      platform: social.platform,
      url: social.url,
      isMe: social.isMe,
    })),
  };
}

export function toPublicLifeEvents(profile: Profile): readonly PublicLifeEvent[] {
  return profile.lifeEvents.map((event) => ({
    date: event.date.toString(),
    precision: event.date.precision,
    kind: event.kind,
    title: event.title,
    description: event.description ?? null,
  }));
}
