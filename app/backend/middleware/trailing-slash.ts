import { createMiddleware } from "hono/factory";

/**
 * 末尾にスラッシュの付いた URL を、付かない URL へ送る (#569)。
 *
 * `/articles/` と `/articles` は、放っておくと同じ中身を別々の URL で返す。canonical と
 * `og:url` は開いた URL をそのまま名乗るので、1 つのページに URL が 2 つあることになり、
 * 構造化データの `url` (末尾スラッシュ無しで固定) とも食い違う。URL を 1 つに寄せる。
 *
 * - **308 で送る。** 恒久的な移動で、メソッドを変えない
 * - **GET / HEAD だけ。** 書き込みの要求を別の URL へ送り直させない
 * - **ルート (`/`) は触らない**
 * - **行き先は同じ origin の絶対 URL で返す。** `//evil.example/` のようなパスの末尾を
 *   落としてそのまま `Location` に書くと `//evil.example` になり、ブラウザはそれを
 *   別のホストへの相対 URL として読む (オープンリダイレクト)。絶対 URL なら同じホストの
 *   パスとして読まれる
 */
export const redirectTrailingSlash = createMiddleware(async (c, next) => {
  const destination = withoutTrailingSlash(c.req.method, new URL(c.req.url));
  if (destination === undefined) return next();
  return c.redirect(destination, 308);
});

/** 送り先。送らなくてよい要求なら undefined。クエリは保つ。 */
function withoutTrailingSlash(method: string, url: URL): string | undefined {
  if (method !== "GET" && method !== "HEAD") return undefined;

  const trimmed = url.pathname.replace(/\/+$/, "");
  if (trimmed === "" || trimmed === url.pathname) return undefined;

  return `${url.origin}${trimmed}${url.search}`;
}
