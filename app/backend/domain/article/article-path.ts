/**
 * 記事 (長文の投稿) のページ URL の形。
 *
 * ここに置く 2 つの表は、旧サイトからの転送 (handlers/legacy-redirects.handler.ts) と
 * Webmention の target の読み取り (domain/webmention) の両方が引く。片方にだけ持たせると、
 * 「転送はするのに Webmention は受けない」のような食い違いが起きる。
 *
 * 設計判断の詳細は ADR 0032 を参照。
 */

/** 記事ページの URL 接頭辞。`/articles/<slug>`。 */
export const ARTICLE_PATH_PREFIX = "/articles/";

/**
 * 改名前の記事ページの URL 接頭辞。
 *
 * `/notes/` は短文の投稿のために空けてある。ここから `/articles/` へ恒久リダイレクトするのは
 * {@link slugsRedirectedFromFormerPath} に載る記事だけで、それ以外の `/notes/<slug>` は移さない。
 */
export const FORMER_ARTICLE_PATH_PREFIX = "/notes/";

/**
 * `/notes/<slug>` から `/articles/<slug>` へ恒久リダイレクトする記事のスラグ。
 *
 * 載せるのは 2026 年に公開した記事だけ。それより前の記事が `/notes/<slug>` で出ていた
 * 期間は短く (このサイト自体が 2026 年 8 月に載せ直したもの)、外に残ったリンクは諦める。
 * `/notes/` の下に恒久リダイレクトを置くほど、短文の投稿がその URL を使えなくなる。
 *
 * 接頭辞の丸ごと書き換え (`/notes/*` → `/articles/*`) を採らないのも同じ理由で、
 * 存在しない `/notes/<なんでも>` にまで恒久リダイレクトを返すことになる。
 *
 * この表は増えない。改名より後に書く記事は最初から `/articles/<slug>` で出る。
 */
export const slugsRedirectedFromFormerPath: ReadonlySet<string> = new Set([
  "back-from-times",
  "claude-code-anywhere-with-devpod",
  "the-dryer-shrank-my-kando-jackets",
]);

/** 記事ページのパス (`/articles/<slug>`)。 */
export function articlePath(slug: string): string {
  return `${ARTICLE_PATH_PREFIX}${slug}`;
}
