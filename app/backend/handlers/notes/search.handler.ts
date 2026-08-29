import { Hono } from "hono";
import { toPublicNote, type PublicNote } from "~/backend/handlers/note-view";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

/** 検索結果の最大件数。 */
const SEARCH_LIMIT = 30;

function parseQuery(raw: string | undefined): string {
  return (raw ?? "").trim();
}

/**
 * 全文検索の公開 JSON API。
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

export interface SearchPageData {
  readonly query: string;
  readonly notes: readonly PublicNote[];
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
    query.length === 0 ? [] : await new D1NoteQueryRepository(env.D1).search(query, SEARCH_LIMIT);
  return { query, notes: results.map((note) => toPublicNote(note)) };
}
