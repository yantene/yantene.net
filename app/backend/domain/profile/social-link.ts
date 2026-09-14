/**
 * 出ていく先の相手。**閉じた並びにしてある。**
 *
 * 絵はコンポーネントの参照 (`components/social/social-links.tsx`) なのでコンテンツ側に
 * 置けない。URL と `isMe` をコンテンツに、`platform` から絵への表をコードに置く分担で、
 * 二重管理ではない。知らない `platform` はプロフィールごとスキップして理由を返す
 * (絵の無いリンクを黙って落とすと、書いた側からは並びが 1 つ減った理由が分からない)。
 */
export const socialPlatforms = ["github", "x", "bluesky", "mastodon", "discord"] as const;

export type SocialPlatform = (typeof socialPlatforms)[number];

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (socialPlatforms as readonly string[]).includes(value);
}

/** プロフィールから出ていく先 1 つ。 */
export interface SocialLink {
  readonly platform: SocialPlatform;
  readonly url: string;
  /**
   * 「これは自分のアカウントである」と主張するか (`rel="me"`)。
   *
   * **主張は相手側からの相互リンクがあって初めて成り立つ。** 向こうのプロフィールに
   * yantene.net を書いていない先に付けると、確かめた側から見て嘘になる。
   */
  readonly isMe: boolean;
}
