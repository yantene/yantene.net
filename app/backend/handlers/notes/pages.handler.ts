import {
  parseNoteSort,
  parsePagination,
  parseTag,
  toPublicNoteList,
  type PublicNoteList,
} from "~/backend/handlers/note-view";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

/**
 * ホームの新着ノートを 1 度に読む件数。
 *
 * ホームは下端に着くたびに続きを足していくので、1 回ぶんが少なすぎると読み込みが
 * 頻繁に走り、多すぎると最初の表示が重くなる。画面 2 つぶんくらいが埋まる量にしてある。
 */
const RECENT_PER_PAGE = 10;

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

/**
 * ホームの新着ノートの 1 ページ目 (公開日降順) を読む。
 *
 * 続きはブラウザが `/api/v1/notes` から取りに行くので、ここが返すページ総数が
 * 「まだ先があるか」の判断材料になる。
 */
export async function loadRecentNotes(env: Env): Promise<PublicNoteList> {
  const query = new D1NoteQueryRepository(env.D1);
  const result = await query.list({
    limit: RECENT_PER_PAGE,
    offset: 0,
    sortBy: "publishedOn",
    direction: "desc",
  });
  return toPublicNoteList(result, 1, RECENT_PER_PAGE);
}
