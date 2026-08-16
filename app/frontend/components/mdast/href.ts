import { isHttpUrl } from "~/lib/http-url";

/**
 * 別タブで開き、`rel` を付ける相手か。
 *
 * 見ているのは「**絶対 URL か**」であって「よそのサイトか」ではない。自分のサイトを
 * 絶対 URL で書いたリンク (`https://yantene.net/notes/x`) も外部として扱う (#318)。
 *
 * 「href に置いてよいか」を問う {@link isHttpUrl} とも別の問い。同じ答えになることが
 * 多いが、片方の都合で広げると (`mailto:` を外部扱いにする等) もう片方が通しては
 * いけないものを通す。
 *
 * プロトコル相対 (`//host`) を含めるのは、文書の中では現在のスキームが補われて
 * よそのホストへ出るため。`isHttpUrl` は基準の無い文字列として読めないので false を
 * 返すが、ここでは外部として扱う。
 */
export function isExternalHref(href: string): boolean {
  return href.startsWith("//") || isHttpUrl(href);
}
