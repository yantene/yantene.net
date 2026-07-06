import { Hono } from "hono";
import {
  parseNoteSort,
  parsePagination,
  parseTag,
  toPublicNoteList,
} from "~/backend/handlers/note-view";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

/**
 * ノートの公開 JSON API ルータ。認証不要 (クローラー・ボット対応のため)。
 * index.ts で auth ガードより前にマウントし、`/api/v1/notes` 配下を公開する。
 *
 * GET /  → 一覧 (ページネーション + ソート)
 *   query: page, per-page, sort-by (published|modified), order (asc|desc)
 */
export function createNotesApiRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/", async (c) => {
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
    return c.json(toPublicNoteList(result, page, perPage));
  });

  return router;
}
