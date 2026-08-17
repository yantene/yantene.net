import { isHttpUrl } from "~/lib/http-url";

/**
 * 別タブで開き、`rel` を付ける相手か。
 *
 * 「href に置いてよいか」を問う {@link isHttpUrl} とは別の問い。同じ答えになることが
 * 多いが、片方の都合で広げると (`mailto:` を外部扱いにする等) もう片方が通しては
 * いけないものを通す。
 *
 * プロトコル相対 (`//host`) を含めるのは、文書の中では現在のスキームが補われて
 * よそのホストへ出るため。`isHttpUrl` は基準の無い文字列として読めないので false を
 * 返すが、ここでは外部として扱う。**`siteOrigin` が分かっていても外部のまま。**
 * 補われるスキームは読み手の見ているページ次第で、こちらでは決められない。
 *
 * @param siteOrigin このサイトの出どころ (`https://yantene.net` 等)。渡すと、そこを
 *   指す絶対 URL を内部として扱う。**渡さなければ絶対 URL はすべて外部。** 記事ページ
 *   以外 (Storybook 等) では出どころが決まらないので、安全側 (別タブ + rel) に倒す
 */
export function isExternalHref(href: string, siteOrigin?: string): boolean {
  if (href.startsWith("//")) return true;
  if (!isHttpUrl(href)) return false;
  if (siteOrigin === undefined) return true;
  return !isSameOrigin(href, siteOrigin);
}

/**
 * 同じ出どころを指しているか。
 *
 * `URL.origin` どうしで比べる。文字列のまま前方一致で見ると、
 * `https://yantene.net.evil.example/` が自分のサイト扱いになる。
 */
function isSameOrigin(href: string, siteOrigin: string): boolean {
  try {
    return new URL(href).origin === new URL(siteOrigin).origin;
  } catch {
    // siteOrigin が URL として読めない。**内部と決めつけない。**
    return false;
  }
}
