import { Hono } from "hono";
import type { LocaleVariables } from "~/backend/middleware/locale";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

type TagsPagesBindings = {
  Bindings: Env;
  Variables: LocaleVariables;
};

/**
 * タグ索引の公開ページルータ (Inertia)。認証不要。
 * GET /tags → 全タグと各記事数の一覧。
 */
export function createTagsPagesRouter(): Hono<TagsPagesBindings> {
  const router = new Hono<TagsPagesBindings>();

  router.get("/tags", async (c) => {
    const query = new D1NoteQueryRepository(c.env.D1);
    const tags = await query.listTags();
    return c.render("tags/index", {
      locale: c.get("locale"),
      tags,
      og: { image: "/og/default", type: "website" },
    });
  });

  return router;
}

/**
 * タグ索引の公開 JSON API ルータ。認証不要 (クローラー対応)。
 * index.ts で auth ガードより前に `/api/v1/tags` にマウントする。
 * GET / → 全タグと各記事数。
 */
export function createTagsApiRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/", async (c) => {
    const query = new D1NoteQueryRepository(c.env.D1);
    const tags = await query.listTags();
    return c.json({ tags });
  });

  return router;
}
