/**
 * 本文のリンクが外向きかどうか。
 *
 * 使う場所が 2 つある。hast の段で `target` と `rel` を足すところ
 * (mdast-renderer.tsx の transformAnchor) と、カードにできなかった URL を素のリンクに
 * 戻すところ (link-card-slot.tsx) である。
 *
 * ⚠️ **この 2 つが問うていることは本当は違う。** 前者は「別タブで開くべきか」、後者は
 * 「href に置いてよいスキームか」で、いま同じ関数で済んでいるのは答えがたまたま一致して
 * いるためにすぎない。片方の都合で広げると (`mailto:` を外部扱いにする等) もう片方が
 * 通してはいけないものを通す。分けるべきかは [#306](https://github.com/yantene/yantene.net/issues/306) で見る。
 *
 * また `app/lib/link-card/bare-link.ts` の `isCardableUrl` (カード化する URL の判定) とも
 * 答えが揃っていない (#306)。あちらは `new URL()` でスキームを見るので `//host` を弾き、大文字の
 * スキームも正しく読む。
 */

/** 別タブ + rel を付ける対象。http(s) 絶対 URL とプロトコル相対 (`//host`) を外部扱いにする。 */
export const isExternalHref = (href: string): boolean =>
  href.startsWith("//") ||
  href.startsWith("http://") ||
  href.startsWith("https://");
