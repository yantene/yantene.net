/**
 * 本文に置かれた iframe の src を、載せてよい形に直す。
 *
 * 記事の Markdown には生の iframe が書かれている。書き手は自分ひとりだが、
 * 「自分が書いたものだから安全」で素通しはしない。相手と形をここで決め打ちにして、
 * 外れたものは落とす。将来 正本の中身が別経路で書き換わっても、通る先は変わらない。
 */

/** 埋め込みを許す相手。増やすときは CSP の frame-src も一緒に広げること。 */
const allowedHosts: ReadonlySet<string> = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** 実際に読み込む先。再生するまで cookie を置かない側に寄せる。 */
const EMBED_HOST = "www.youtube-nocookie.com";

/**
 * 埋め込んでよい src なら、正規化した URL を返す。そうでなければ null。
 *
 * 古い記事はプロトコルを省いた `//host/...` で書かれていることがある。ページが https でも
 * dev の http でも同じ先を指すよう、ここで https に倒す。
 */
export function normalizeEmbedSrc(src: string): string | null {
  const url = toUrl(src);
  if (url === null) return null;
  if (!allowedHosts.has(url.hostname)) return null;
  // 埋め込み専用のパスだけを通す。watch や channel を frame に入れる理由がない。
  if (!url.pathname.startsWith("/embed/")) return null;
  if (url.pathname === "/embed/") return null;

  url.protocol = "https:";
  url.hostname = EMBED_HOST;
  url.port = "";
  return url.toString();
}

function toUrl(src: string): URL | null {
  try {
    return new URL(src.startsWith("//") ? `https:${src}` : src);
  } catch {
    return null;
  }
}
