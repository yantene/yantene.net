/**
 * ノート内の相対的なアセット URL (画像・リンク) をアセット API URL (ルート相対) に解決する。
 * 絶対 URL (http/https 等スキーム付き) やルート相対 (`/...`) は解決済みとみなしそのまま返す。
 * 相対パス (`./cover.png` / `img/a.png`) は URL 解決で `./` を畳んでから
 * `/api/v1/notes/<slug>/assets/<path>` にする。
 */

/** 解決の基準になる、そのノートのアセットの入口。 */
export function assetPrefixOf(slug: string): string {
  return `/api/v1/notes/${slug}/assets/`;
}

/**
 * 解決の対象にしないもの。
 *
 * - 空文字 — 行き先が書かれていない
 * - `#` 始まり — 同じページの中の行き先。`[戻る](#top)` を assets 配下へ押し込むと 404 になる
 * - `?` 始まり — 同じページに対する問い合わせ。RFC 3986 では `#` と同じく同一文書参照
 *
 * どれも「基準からの相対パス」ではないのに、スキームも `/` も持たないため、素朴に
 * 判定すると相対パスの側へ落ちる (#297)。
 */
function isSelfReferencing(url: string): boolean {
  return url === "" || url.startsWith("#") || url.startsWith("?");
}

export function resolveAssetUrl(slug: string, url: string): string {
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(url);
  if (hasScheme || url.startsWith("/") || isSelfReferencing(url)) return url;

  // ダミーオリジンを与えて相対解決し、パス以降を取り出す。これで `./` は畳まれる。
  const prefix = assetPrefixOf(slug);
  const resolved = new URL(url, `https://note.invalid${prefix}`);
  /*
   * クエリと断片も繋ぐ。`./song.mid#bar-32` の `#bar-32` や `./a.png?v=2` の `?v=2` は
   * 書き手が意図して付けたもので、pathname だけを取ると黙って消える (#297)。
   */
  const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;

  /*
   * `../` でアセットの外へ出たものは書き換えない。
   *
   * `../x.png` は `/api/v1/notes/<slug>/x.png` に、`../../../x.png` は `/api/v1/x.png` に
   * なる。どちらもこのノートのアセットではなく、**無関係な API のパスを指す URL を
   * こちらが作り出している**ことになる。書いたまま返せば、少なくとも出どころが分かる。
   */
  return path.startsWith(prefix) ? path : url;
}
