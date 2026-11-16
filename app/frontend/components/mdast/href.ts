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

/** 記事ページのパス。`.md` (原文) や `/articles` (一覧) には当たらない。 */
const ARTICLE_PATH_PATTERN = /^\/articles\/([a-z0-9-]+)\/?$/;

/**
 * リンクがこのサイトの記事ページを指していれば、その slug を返す。そうでなければ null。
 *
 * プレビューのチップを出す相手を選ぶためのもの。見るのは形だけで、その記事が在るか・
 * 読み手に見えるかはプレビュー API が答える。
 *
 * 当たるのは、ルート相対 (`/articles/<slug>`) と、このサイトを指す絶対 URL
 * ({@link isExternalHref} が内部と見るもの) だけ。`./other` のような相対パスは、
 * 何を基準に解決されるかがここでは決まらないので当てない。節への `#...` や `?...` が
 * 付いていても、指している記事は同じなので当たる。
 */
export function articleSlugOfHref(href: string, siteOrigin?: string): string | null {
  if (href.startsWith("//")) return null;
  const isRootRelative = href.startsWith("/");
  if (!isRootRelative && (!isHttpUrl(href) || isExternalHref(href, siteOrigin))) return null;

  const pathname = pathnameOf(href);
  return pathname === null ? null : (ARTICLE_PATH_PATTERN.exec(pathname)?.[1] ?? null);
}

/** リンクのパス部分。URL として読めなければ null。基準は解決のためだけに置く。 */
function pathnameOf(href: string): string | null {
  try {
    return new URL(href, "https://base.invalid").pathname;
  } catch {
    return null;
  }
}
