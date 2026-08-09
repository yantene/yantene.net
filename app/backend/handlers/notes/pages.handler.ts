import {
  parseNoteSort,
  parsePagination,
  parseTag,
  toPublicNoteList,
  type PublicNoteList,
} from "~/backend/handlers/note-view";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

/**
 * ホームに出す「最近」の件数。
 *
 * ホームは一覧の代わりではなく入口なので、続きは足さずここで打ち切って `/notes` へ送る。
 * 年の区切りが 2〜3 個現れる程度に留め、ヒーローの直後が記事で埋まらないようにする。
 */
const RECENT_COUNT = 5;

/** ホームに出す「よく読まれている」の件数。脇に添える柱なので短く。 */
const POPULAR_COUNT = 4;

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

export interface HomePageData {
  /** 公開日の新しい順。ホームの主となる列。 */
  readonly recent: PublicNoteList["notes"];
  /**
   * よく読まれている順のつもりの列。
   *
   * ⚠️ いまは読まれた回数を数えていないため、**順位は本物ではない**。枠と見た目を先に
   * 作るための仮置きで、公開日の古い順を借りているだけ。読者には人気順に見えてしまうので、
   * 本番に出す前に #110 (アクセス集計) を入れて本物に差し替えること。
   */
  readonly popular: PublicNoteList["notes"];
}

/**
 * ホームのデータを読む (Composition Root)。
 *
 * ホームは一覧の代わりではなく入口なので、続きは足さずここで打ち切る。全件を辿る導線は
 * `/notes` が持つ。
 */
export async function loadHomePage(env: Env): Promise<HomePageData> {
  const query = new D1NoteQueryRepository(env.D1);

  const recent = await query.list({
    limit: RECENT_COUNT,
    offset: 0,
    sortBy: "publishedOn",
    direction: "desc",
  });

  // 仮置き。読まれた回数を持っていないので、新しい順とは別の並びを借りて枠を埋める。
  const popular = await query.list({
    limit: POPULAR_COUNT,
    offset: 0,
    sortBy: "publishedOn",
    direction: "asc",
  });

  return {
    recent: toPublicNoteList(recent, 1, RECENT_COUNT).notes,
    popular: toPublicNoteList(popular, 1, POPULAR_COUNT).notes,
  };
}
