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
 */
export const socialPlatforms = ["github", "x", "bluesky", "mastodon", "discord"] as const;

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
};

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (socialPlatforms as readonly string[]).includes(value);
}
