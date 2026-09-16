/*
 * 出ていく先の種類。
 *
 * どの先を出すか (URL と、自分のアカウントだと主張するか) はコンテンツリポジトリの
 * プロフィールが持ち、種類ごとの見せ方 (アイコン・名前) はコードが持つ。アイコンは
 * コンポーネントの参照なのでコンテンツ側に置けないため、種類の名前だけを両者の
 * 待ち合わせ場所にする。
 *
 * ここに無い platform を書いた行は refresh がスキップして理由を返す (fail-loud)。
 * 黙って落とすと、書いたのに出ない先ができる。
 *
 * ⚠️ **`email` だけはよその会社ではない。** 出ていく先として同じ並びに出すので同じ表に
 * 入れてあるが、次の 2 点が他と違う。
 *
 * - URL のスキームが `mailto:` (他は http(s))。`SocialAccount` が種別ごとに見分ける
 * - 絵がブランドの印ではないので、`brand-mark` が要らない
 *   ([ADR 0043](../../docs/adr/0043-show-social-marks-as-each-brand-requires.md) の
 *   「黒か白以外に染めるな」は掛からない。並びを揃えるために黒で出しているだけ)
 */
export const socialPlatforms = ["github", "x", "bluesky", "mastodon", "discord", "email"] as const;

export type SocialPlatform = (typeof socialPlatforms)[number];

/**
 * 画面に出す名前。訳さない (product.md「見える名前は訳さない」)。
 *
 * 絵しか出さない場所では `aria-label` と `title` に使う。
 */
export const socialPlatformLabels: Record<SocialPlatform, string> = {
  github: "GitHub",
  x: "X",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  discord: "Discord",
  email: "Email",
};

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (socialPlatforms as readonly string[]).includes(value);
}
