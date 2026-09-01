/**
 * フィードの名乗り。フィード本体 (backend/handlers/feed.handler) と、ページの
 * `<link rel="alternate">` (frontend/routes) の両方がここから引く。
 *
 * 両者を別々に組み立てると、リーダーに見える名前と実際のフィードの `<title>` が
 * ずれる。リーダーは title で購読先を見分けるので、ずれた時点で「同じ名前の
 * 別フィード」に見えてしまう。フロント・バック共通のここを唯一の出どころにする。
 */

const FEED_TITLE = "やんてね";
/* i18n の meta.description と同じ一文。リーダーに出る名乗りなので、サイトの説明と
 * 食い違わせない。ja.json を書き換えたらここも合わせること (あちらは React の外から
 * 引けないので、同じ文字列を二度持つしかない)。 */
const FEED_SUBTITLE = "Web の向こうから。エッセイ、技術記事、つくったもの。";

export interface FeedIdentity {
  readonly title: string;
  readonly subtitle: string;
  /** フィード自身のパス (Atom の rel=self、ページの rel=alternate)。 */
  readonly path: string;
  /** 対応する HTML ページのパス。Atom の id もこれを使う。 */
  readonly alternatePath: string;
}

/** サイト全体のフィードの名乗り。タグを廃止したので、フィードは 1 本だけになった。 */
export function feedIdentity(): FeedIdentity {
  return {
    title: FEED_TITLE,
    subtitle: FEED_SUBTITLE,
    path: "/feed.xml",
    alternatePath: "/",
  };
}
