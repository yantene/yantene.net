import { Hono } from "hono";
import { toPublicArticle, type PublicArticle } from "~/backend/handlers/article-view";
import { D1ArticleQueryRepository } from "~/backend/infra/d1/repositories";

/** 検索結果の最大件数。 */
const SEARCH_LIMIT = 30;

function parseQuery(raw: string | undefined): string {
  return (raw ?? "").trim();
}

/**
 * 全文検索の公開 JSON API。
 * GET /?q= → { query, articles }。
 */
export function createSearchApiRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/", async (c) => {
    const query = parseQuery(c.req.query("q"));
    const articles =
      query.length === 0
        ? []
        : await new D1ArticleQueryRepository(c.env.D1).search(query, SEARCH_LIMIT);
    return c.json({ query, articles: articles.map((article) => toPublicArticle(article)) });
  });

  return router;
}

export interface SearchPageData {
  readonly query: string;
  readonly articles: readonly PublicArticle[];
}

/**
 * 全文検索ページのデータを読む (Composition Root)。認証不要。
 * 空クエリでは検索を実行せず空結果を返す。
 */
export async function loadSearchPage(
  env: Env,
  rawQuery: string | undefined,
): Promise<SearchPageData> {
  const query = parseQuery(rawQuery);
  const results =
    query.length === 0
      ? []
      : await new D1ArticleQueryRepository(env.D1).search(query, SEARCH_LIMIT);
  return { query, articles: results.map((article) => toPublicArticle(article)) };
}
