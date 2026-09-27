/**
 * 本文に置かれた `<audio>` / `<video>` の src が、自分のアセットかどうかを見る。
 *
 * 記事の Markdown には生の `<audio>` と `<video>` が書かれている。書き手は自分ひとりだが、
 * 「自分が書いたものだから安全」で素通しはしない。embed.ts と同じ二段構えで、
 * sanitize がタグと属性の形を許し、ここが src の中身を決め打ちに絞る。
 *
 * 埋め込み (iframe) と違って相手のホストは無く、通すのは自分のアセット API だけである。
 * 外部の音源や動画を貼る予定は無いし、貼れるようにすると CSP の media-src を
 * 相手ごとに広げ続けることになる。
 */

/** アセット API のパス。resolveAssetUrl が組み立てる形と対にする。 */
const assetPathPattern = /^\/api\/v1\/articles\/[^/]+\/assets\/.+$/;

/**
 * 音源や動画として通してよい src なら true。
 *
 * 画像やリンクと違い、生 HTML の中身は MDAST の URL 書き換え (withAssetUrls) が
 * 届かない。だから本文にはルート相対の絶対パスが直接書かれている前提で見る。
 * 相対パス (`./song.opus`) は解決されないまま届くので、ここで落とす。
 */
export function isArticleAssetSrc(src: string): boolean {
  return assetPathPattern.test(src);
}
