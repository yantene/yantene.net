import { Hono } from "hono";
import {
  parseArticleSort,
  parsePagination,
  toPublicArticleList,
} from "~/backend/handlers/article-view";
import { D1ArticleQueryRepository } from "~/backend/infra/d1/repositories";

/**
 * 記事の公開 JSON API ルータ。`/api/v1/articles` 配下を公開する。
 *
 * GET /  → 一覧 (ページネーション + ソート)
 *   query: page, per-page, sort-by (published|modified), order (asc|desc)
 */
export function createArticlesApiRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/", async (c) => {
    const { page, perPage, limit, offset } = parsePagination(
      c.req.query("page"),
      c.req.query("per-page"),
    );
    const { sortBy, direction } = parseArticleSort(c.req.query("sort-by"), c.req.query("order"));

    const query = new D1ArticleQueryRepository(c.env.D1);
    const result = await query.list({ limit, offset, sortBy, direction });
    return c.json(toPublicArticleList(result, page, perPage));
  });

  return router;
}
