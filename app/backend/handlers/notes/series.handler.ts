import { Hono } from "hono";
import type { LocaleVariables } from "~/backend/middleware/locale";
import { toPublicNote } from "~/backend/handlers/note-view";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

/**
 * 連載 (シリーズ) 索引の公開ページルータ (Inertia)。認証不要。
 * GET /series/:slug → そのシリーズの記事を seriesOrder 昇順で一覧。
 * 該当が無ければ 404 ステータスで not-found 状態を描画する。
 */
export function createSeriesPagesRouter(): Hono<{
  Bindings: Env;
  Variables: LocaleVariables;
}> {
  const router = new Hono<{ Bindings: Env; Variables: LocaleVariables }>();

  router.get("/series/:slug", async (c) => {
    const slug = c.req.param("slug");
    const found = await new D1NoteQueryRepository(c.env.D1).listBySeries(slug);
    const notes = found.map((note) => toPublicNote(note));

    if (notes.length === 0) {
      c.status(404);
      return c.render("series/show", {
        locale: c.get("locale"),
        name: null,
        notes: [],
      });
    }

    return c.render("series/show", {
      locale: c.get("locale"),
      name: notes[0].series?.name ?? slug,
      notes,
      og: { image: "/og/default", type: "website" },
    });
  });

  return router;
}
