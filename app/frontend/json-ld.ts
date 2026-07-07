/* eslint-disable no-secrets/no-secrets -- MIME タイプ文字列 (application/ld+json) の誤検知。 */
/**
 * schema.org 構造化データを `<script type="application/ld+json">` タグ文字列にする。
 *
 * - jsonLd が undefined のページでは空文字を返す。`JSON.stringify(undefined)` は
 *   文字列 "undefined" ではなく値 undefined を返すため、そのまま `.replaceAll` すると
 *   TypeError で SSR が 500 になる。ここで必ず早期 return してその踏み外しを防ぐ。
 * - 本文中の "<" を `<` にエスケープし、値に "</script>" が含まれても
 *   スクリプトが途中で打ち切られないようにする。
 */
export function renderJsonLd(jsonLd: unknown): string {
  if (jsonLd === undefined) return "";
  const body = JSON.stringify(jsonLd).replaceAll("<", String.raw`\u003c`);
  return `<script type="application/ld+json">${body}</script>`;
}
