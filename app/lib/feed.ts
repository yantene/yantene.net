/**
 * フィードの名乗り。フィード本体 (backend/handlers/feed.handler) と、ページの
 * `<link rel="alternate">` (frontend/routes) の両方がここから引く。
 *
 * 両者を別々に組み立てると、リーダーに見える名前と実際のフィードの `<title>` が
 * ずれる。リーダーは title で購読先を見分けるので、ずれた時点で「同じ名前の
 * 別フィード」に見えてしまう。フロント・バック共通のここを唯一の出どころにする。
 */

const FEED_TITLE = "やんてね";
const FEED_SUBTITLE = "yantene の発信を集約するハブ";

export interface FeedIdentity {
  readonly title: string;
  readonly subtitle: string;
  /** フィード自身のパス (Atom の rel=self、ページの rel=alternate)。 */
  readonly path: string;
  /**
   * 対応する HTML ページのパス。Atom の id もこれを使う。
   *
   * id は購読の同一性を決める鍵なので、タグごとに別の URI になる必要がある
   * (同じ id を使い回すと、リーダーが別のフィードを同じ購読として扱う)。
   */
  readonly alternatePath: string;
}

/**
 * タグを渡すとそのタグのフィード、渡さなければサイト全体のフィードの名乗りを返す。
 *
 * クエリの組み立てに URLSearchParams ではなく encodeURIComponent を使うのは、
 * 空白を `+` で表すのが application/x-www-form-urlencoded の作法だから。
 * `%20` のままにしておけば、どのパーサを通しても同じタグに戻る。
 */
export function feedIdentity(tag?: string | null): FeedIdentity {
  if (tag === undefined || tag === null) {
    return {
      title: FEED_TITLE,
      subtitle: FEED_SUBTITLE,
      path: "/feed.xml",
      alternatePath: "/",
    };
  }

  const encoded = encodeURIComponent(tag);
  return {
    title: `${FEED_TITLE} — ${tag}`,
    subtitle: `タグ「${tag}」のノート`,
    path: `/feed.xml?tag=${encoded}`,
    alternatePath: `/notes?tag=${encoded}`,
  };
}
