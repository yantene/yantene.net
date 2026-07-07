import { Hono } from "hono";
import type { LocaleVariables } from "~/backend/middleware/locale";
import {
  parseNoteSort,
  parsePagination,
  parseTag,
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

    const tag = parseTag(c.req.query("tag"));

    const query = new D1NoteQueryRepository(c.env.D1);
    const result = await query.list({ limit, offset, sortBy, direction, tag });

    return c.render("notes/index", {
      locale: c.get("locale"),
      ...toPublicNoteList(result, page, perPage),
      // ページ送りリンク・見出しで使うため、現在の絞り込みタグと並び順を渡す。
      tag: tag ?? null,
      sort: {
        sortBy: c.req.query("sort-by") ?? null,
        order: c.req.query("order") ?? null,
      },
      og: { image: "/og/default", type: "website" },
    });
  });

  return router;
}
