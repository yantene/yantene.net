import type { HistoryEntry, Profile } from "~/backend/domain/profile";
import type { SocialPlatform } from "~/lib/social-platforms";
import { DEFAULT_CONTENT_LANGUAGE } from "~/lib/content-language";

export interface PublicSocialAccount {
  readonly platform: SocialPlatform;
  readonly url: string;
  /** 自分のアカウントだと主張する (`rel="me"` を出す) かどうか。 */
  readonly isMe: boolean;
}

/** 経歴の 1 件。書いていない欄は null で渡す (loader の応答に undefined は残らない)。 */
export interface PublicHistoryEntry {
  /** `2011` / `2011-06` / `2011-06-04` のどれか。**桁の数が精度を表す。** */
  readonly date: string;
  /** 終わり。書いていなければ null (点の出来事)。始まりと同じ精度で入る。 */
  readonly until: string | null;
  readonly text: string;
  readonly url: string | null;
  readonly note: string | null;
  /** 章を畳んでいても出すかどうか (ADR 0045)。 */
  readonly important: boolean;
}

/** 章 1 つと、その中の出来事。 */
export interface PublicHistoryChapter {
  readonly chapter: string;
  readonly entries: readonly PublicHistoryEntry[];
}

/**
 * 3 か所 (トップのヒーロー・記事の末尾・`/about`) が共通で出すプロフィール。
 *
 * 長い自己紹介 (MDAST) はここに含めない。読むのは `/about` だけなので、記事を 1 本
 * 開くたびに運ぶ理由が無い。
 *
 * **経歴も同じ理由で入れない** (`toPublicHistory` が別に組む)。出るのは `/about` の
 * 1 か所だけなので、記事ページの応答に 10 件以上の出来事を載せることになる。引くのも
 * 別の口 (`IProfileQueryRepository.findHistory`)。
 */
/**
 * 機械 (検索エンジンと AI) に名乗るための、名前まわりの欄。英語名を除いて画面には出ない。
 * 書いていない欄は null (loader の応答に undefined は残らない)。
 */
export interface PublicProfileIdentity {
  readonly nameEn: string | null;
  readonly familyName: string | null;
  readonly givenName: string | null;
  readonly alternateNames: readonly string[];
  readonly jobTitle: string | null;
  readonly description: string | null;
  readonly descriptionEn: string | null;
}

export interface PublicProfile {
  /** 本名。JSON-LD の `Person.name` と `/about` の `<title>` に出る。 */
  readonly name: string;
  /**
   * 画面に出す名前。英語名があれば本名の後ろに括弧で添える (`吉田 周平 (Shuhei YOSHIDA)`)。
   *
   * ⚠️ **機械に名乗る名前には使わない。** 括弧つきの字は名前ではないので、JSON-LD の
   * `name` に入れると別名との突き合わせが効かなくなる。あちらは `name` を使う。
   */
  readonly displayName: string;
  readonly identity: PublicProfileIdentity;
  /** 短い自己紹介。行に分けてある (描画側が改行を保ったまま 1 つの段落に流す)。 */
  readonly tagline: readonly string[];
  readonly socials: readonly PublicSocialAccount[];
  /**
   * 短い自己紹介と長い自己紹介 (`/about` の本文) の言語 (BCP 47)。画面はこれを器の
   * `lang` に付ける (`<html lang>` は UI の言語なので、コンテンツの言語とは別に持つ)。
   */
  readonly language: string;
}

export function toPublicProfile(profile: Profile): PublicProfile {
  const { identity } = profile;
  const name = profile.name.toJSON();
  return {
    name,
    displayName: identity.nameEn === undefined ? name : `${name} (${identity.nameEn})`,
    identity: {
      nameEn: identity.nameEn ?? null,
      familyName: identity.familyName ?? null,
      givenName: identity.givenName ?? null,
      alternateNames: identity.alternateNames,
      jobTitle: identity.jobTitle ?? null,
      description: identity.description ?? null,
      descriptionEn: identity.descriptionEn ?? null,
    },
    tagline: profile.tagline.lines(),
    socials: profile.socials.map((social) => ({
      platform: social.platform,
      url: social.url,
      isMe: social.isMe,
    })),
    language: DEFAULT_CONTENT_LANGUAGE,
  };
}

/**
 * 経歴を章ごとに畳む。`/about` だけが使う。
 *
 * **並べ直さない。** 章の順も章の中の順も、書き手がフロントマターに書いた順のまま。
 * `Map` は入れた順を保つので、同じ章が離れて書かれていれば最初に現れた位置に畳まれる。
 *
 * 年で並べ替えないのは、並びが書き手のものだから。同じ年に卒業と入学が並ぶとき、
 * どちらを先に置くかを機械が決める理由が無い。
 */
export function toPublicHistory(history: readonly HistoryEntry[]): readonly PublicHistoryChapter[] {
  const chapters = new Map<string, PublicHistoryEntry[]>();
  for (const entry of history) {
    const entries = chapters.get(entry.chapter) ?? [];
    if (entries.length === 0) chapters.set(entry.chapter, entries);
    entries.push({
      date: entry.date.toString(),
      until: entry.until?.toString() ?? null,
      text: entry.text,
      url: entry.url ?? null,
      note: entry.note ?? null,
      important: entry.important,
    });
  }
  return [...chapters].map(([chapter, entries]) => ({ chapter, entries }));
}
