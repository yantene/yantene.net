import { Temporal } from "@js-temporal/polyfill";
import type { Note } from "~/backend/domain/note";
import {
  rankNoteScores,
  VIEW_SCORE_HALF_LIFE_DAYS,
} from "~/backend/domain/note-view";
import {
  parseNoteSort,
  parsePagination,
  parseTag,
  toPublicNote,
  toPublicNoteList,
  type PublicNoteList,
} from "~/backend/handlers/note-view";
import {
  D1NoteQueryRepository,
  D1NoteViewQueryRepository,
} from "~/backend/infra/d1/repositories";

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
  /** 公開日の新しい順。 */
  readonly recent: PublicNoteList["notes"];
  /**
   * よく読まれている順。
   *
   * 読まれた回数に時間減衰をかけて並べる (詳しくは domain/note-view/view-ranking)。
   * まだ誰にも読まれていなければ空になる。空の枠や当てずっぽうの順位は出さない。
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

  return {
    recent: toPublicNoteList(recent, 1, RECENT_COUNT).notes,
    popular: await loadPopularNotes(env, query),
  };
}

/**
 * よく読まれているノートを、時間減衰をかけた順に読む。
 *
 * 減衰を D1 に任せず持ち帰ってから当てているのは、D1 が冪乗・指数の関数を許していない
 * ため。読む行数は「一度でも読まれた記事の数」で頭打ちになる (日ごとの履歴は持たない)。
 */
async function loadPopularNotes(
  env: Env,
  query: D1NoteQueryRepository,
): Promise<PublicNoteList["notes"]> {
  const scores = await new D1NoteViewQueryRepository(env.D1).listScores();

  const ranked = rankNoteScores(scores, {
    halfLifeDays: VIEW_SCORE_HALF_LIFE_DAYS,
    today: Temporal.Now.plainDateISO("UTC").toString(),
  }).slice(0, POPULAR_COUNT);
  if (ranked.length === 0) return [];

  // 順位は id の並びで決まっているので、引き直した行をその並びに戻す。
  const notes = await query.findByIds(ranked.map((item) => item.noteId));
  const byId = new Map<string, Note>(notes.map((note) => [note.id, note]));
  return ranked
    .map((item) => byId.get(item.noteId))
    .filter((note) => note !== undefined)
    .map((note) => toPublicNote(note));
}
