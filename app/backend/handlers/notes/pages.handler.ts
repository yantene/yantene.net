import {
  parseNoteSort,
  parsePagination,
  parseTag,
  toPublicNote,
  toPublicNoteList,
  type PublicNote,
  type PublicNoteList,
} from "~/backend/handlers/note-view";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

/** ホームに出す新着ノートの件数。 */
const RECENT_LIMIT = 6;

export interface NotesListPageData extends PublicNoteList {
  /** 絞り込み中のタグ (未絞り込みなら null)。 */
  readonly tag: string | null;
  /** ページ送りリンクの再構築に使う、リクエストされた並び順。 */
  readonly sort: {
    readonly sortBy: string | null;
    readonly order: string | null;
  };
}

/**
 * ノート一覧ページのデータを読む (Composition Root)。
 * ページング・並び順・タグ絞り込みはクエリ文字列から解決する。
 */
export async function loadNotesListPage(
  env: Env,
  url: URL,
): Promise<NotesListPageData> {
  const { page, perPage, limit, offset } = parsePagination(
    url.searchParams.get("page") ?? undefined,
    url.searchParams.get("per-page") ?? undefined,
  );
  const { sortBy, direction } = parseNoteSort(
    url.searchParams.get("sort-by") ?? undefined,
    url.searchParams.get("order") ?? undefined,
  );
  const tag = parseTag(url.searchParams.get("tag") ?? undefined);

  const query = new D1NoteQueryRepository(env.D1);
  const result = await query.list({ limit, offset, sortBy, direction, tag });

  return {
    ...toPublicNoteList(result, page, perPage),
    tag: tag ?? null,
    sort: {
      sortBy: url.searchParams.get("sort-by"),
      order: url.searchParams.get("order"),
    },
  };
}

/** ホームの新着ノート (公開日降順・最大 6 件) を読む。 */
export async function loadRecentNotes(
  env: Env,
): Promise<readonly PublicNote[]> {
  const query = new D1NoteQueryRepository(env.D1);
  const result = await query.list({
    limit: RECENT_LIMIT,
    offset: 0,
    sortBy: "publishedOn",
    direction: "desc",
  });
  return result.notes.map((note) => toPublicNote(note));
}
