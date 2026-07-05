/**
 * ノート内の相対的な画像 URL をアセット API URL (ルート相対) に解決する。
 * 絶対 URL (http/https 等スキーム付き) やルート相対 (`/...`) は解決済みとみなしそのまま返す。
 * 相対パス (`./cover.png` / `img/a.png` / `../x.png`) は URL 解決で `./` `../` を畳んでから
 * `/api/v1/notes/<slug>/assets/<path>` にする。
 */
export function resolveAssetUrl(slug: string, url: string): string {
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(url);
  if (hasScheme || url.startsWith("/")) return url;

  // ダミーオリジン + アセットベースに対して相対解決し、pathname だけ取り出す。
  // これで "./" は畳まれ、"assets/../x" のような壊れたパスにならない。
  const base = `https://note.invalid/api/v1/notes/${slug}/assets/`;
  return new URL(url, base).pathname;
}
