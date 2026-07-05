import { Hono } from "hono";
import type { LocaleVariables } from "~/backend/middleware/locale";
import {
  parseNoteSort,
  parsePagination,
  toPublicNoteList,
} from "~/backend/handlers/note-view";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

type NotesPagesBindings = {
  Bindings: Env;
  Variables: LocaleVariables;
};

/**
 * ノートの公開ページルータ (Inertia)。認証不要 (クローラー・ボット対応)。
 * createPagesRouter 内で locale + inertia ミドルウェア適用後・auth ガードより前に
 * マウントし、ミドルウェアを継承しつつ公開する。
 */
export function createNotesPagesRouter(): Hono<NotesPagesBindings> {
  const router = new Hono<NotesPagesBindings>();

  router.get("/notes", async (c) => {
    const { page, perPage, limit, offset } = parsePagination(
      c.req.query("page"),
      c.req.query("per-page"),
    );
    const { sortBy, direction } = parseNoteSort(
      c.req.query("sort-by"),
      c.req.query("order"),
    );

    const query = new D1NoteQueryRepository(c.env.D1);
    const result = await query.list({ limit, offset, sortBy, direction });

    return c.render("notes/index", {
      locale: c.get("locale"),
      ...toPublicNoteList(result, page, perPage),
    });
  });

  return router;
}
