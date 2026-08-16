/**
 * URL のスキームにまつわる判断。
 *
 * RFC 3986 でスキームは**大小を区別しない**。`HTTPS://example.com/` は正しい書き方で、
 * ブラウザは普通に開く。素朴に `startsWith("https://")` と書くとこれを取り逃す (#306)。
 */

/** 載せてよいスキーム。 */
const httpProtocols: ReadonlySet<string> = new Set(["http:", "https:"]);

/** スキームらしき先頭。`https:` / `mailto:` / `data:` などに当たる。 */
const schemePattern = /^[a-z][a-z0-9+.-]*:/i;

/**
 * http(s) の URL として読めるか。スキームの大小は問わない。
 *
 * 相対 URL・`mailto:`・`javascript:` はすべて false。プロトコル相対 (`//host`) も、
 * 単体では基準が無く読めないので false になる。
 */
export function isHttpUrl(url: string): boolean {
  // 相対 URL は throw させずに弾く。本文のリンクは内部への参照 (`#fn-1` や `/notes/x`)
  // のほうが多く、そのたびに例外を作るのは無駄が大きい。
  if (!schemePattern.test(url)) return false;
  try {
    return httpProtocols.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * スキームだけを小文字にする。スキームを持たない URL はそのまま返す。
 *
 * **sanitize に渡す前に通すこと。** hast-util-sanitize は許すスキームを大小を区別する
 * 完全一致で照合するので、`HTTPS://example.com/` は許可リストに載っていない扱いになり、
 * **href ごと落ちて押せない文字列になる** (#306)。
 */
export function withLowercaseScheme(url: string): string {
  const scheme = schemePattern.exec(url)?.[0];
  if (scheme === undefined) return url;
  return scheme.toLowerCase() + url.slice(scheme.length);
}
