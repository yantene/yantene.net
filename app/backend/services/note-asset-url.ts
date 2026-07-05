/**
 * ノート内の相対的な画像 URL をアセット API URL (ルート相対) に解決する。
 * 絶対 URL (http/https) やルート相対 (`/...`) は解決済みとみなしそのまま返す。
 * 相対パス (`./cover.png` / `cover.png`) を `/api/v1/notes/<slug>/assets/<path>` にする。
 */
export function resolveAssetUrl(slug: string, url: string): string {
  const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(url);
  if (isAbsolute || url.startsWith("/")) return url;
  const clean = url.replace(/^\.\//, "");
  return `/api/v1/notes/${slug}/assets/${clean}`;
}
