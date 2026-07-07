import { Hono } from "hono";
import type { LocaleVariables } from "~/backend/middleware/locale";
import { toPublicNote } from "~/backend/handlers/note-view";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

/** 検索結果の最大件数。 */
const SEARCH_LIMIT = 30;

function parseQuery(raw: string | undefined): string {
  return (raw ?? "").trim();
}

/**
 * 全文検索の公開 JSON API。認証不要 (index.ts で auth ガードより前にマウント)。
 * GET /?q= → { query, notes }。
 */
export function createSearchApiRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/", async (c) => {
    const query = parseQuery(c.req.query("q"));
    const notes =
      query.length === 0
        ? []
        : await new D1NoteQueryRepository(c.env.D1).search(query, SEARCH_LIMIT);
    return c.json({ query, notes: notes.map((note) => toPublicNote(note)) });
  });

  return router;
}

/**
 * 全文検索の公開ページルータ (Inertia)。認証不要。createPagesRouter の
 * locale + inertia ミドルウェア配下・auth ガードより前にマウントする。
 */
export function createSearchPagesRouter(): Hono<{
  Bindings: Env;
  Variables: LocaleVariables;
}> {
  const router = new Hono<{ Bindings: Env; Variables: LocaleVariables }>();

  router.get("/search", async (c) => {
    const query = parseQuery(c.req.query("q"));
    const results =
      query.length === 0
        ? []
        : await new D1NoteQueryRepository(c.env.D1).search(query, SEARCH_LIMIT);
    return c.render("search", {
      locale: c.get("locale"),
      query,
      notes: results.map((note) => toPublicNote(note)),
      og: { image: "/og/default", type: "website" },
    });
  });

  return router;
}
