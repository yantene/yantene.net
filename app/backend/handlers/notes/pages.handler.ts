import type { Note, NoteListResult, NoteTagCount } from "~/backend/domain/note";
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

/**
 * 検索で拾う最大件数。
 *
 * 関連度の低いところまで辿っても読まれないので、ここで打ち切る。タグとの併用では
 * この中から絞るため、絞り込みで取りこぼさない程度には広く取っておく。
 */
const SEARCH_LIMIT = 30;

export interface NotesListPageData extends PublicNoteList {
  /** 検索語 (未指定なら空文字)。 */
  readonly query: string;
  /** 絞り込み中のタグ (未絞り込みなら null)。 */
  readonly tag: string | null;
  /** 一覧に添えるタグの索引 (記事数の多い順)。 */
  readonly tags: readonly NoteTagCount[];
  /** ページ送りリンクの再構築に使う、リクエストされた並び順。 */
  readonly sort: {
    readonly sortBy: string | null;
    readonly order: string | null;
  };
}

/**
 * ノート一覧ページのデータを読む (Composition Root)。
 *
 * 検索・タグ絞り込み・ページング・並び順をすべてクエリ文字列から解決する。このページが
 * 検索の入口と結果を兼ねるので、絞り込みの状態は URL にだけ持たせる (共有できて、
 * 戻るが効く)。
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
  const searchQuery = (url.searchParams.get("q") ?? "").trim();

  const query = new D1NoteQueryRepository(env.D1);
  const isSearching = searchQuery.length > 0;
  const [list, tags] = await Promise.all([
    isSearching
      ? searchNotes(query, searchQuery, tag)
      : query.list({ limit, offset, sortBy, direction, tag }),
    query.listTags(),
  ]);

  /*
   * 検索は上限までを一度に返すので、続きは無い。1 ページに収めて継ぎ足しを起こさない。
   * 起こしてしまうと、続きを取る API には検索語が渡らず、無関係な記事が混ざる。
   */
  const paged = isSearching
    ? toPublicNoteList(list, 1, Math.max(list.notes.length, 1))
    : toPublicNoteList(list, page, perPage);

  return {
    ...paged,
    query: searchQuery,
    tag: tag ?? null,
    tags,
    sort: {
      sortBy: url.searchParams.get("sort-by"),
      order: url.searchParams.get("order"),
    },
  };
}

/**
 * 検索語で引き、タグの指定があればそこから絞る。
 *
 * 索引は関連度順に返すので、その並びを保ったまま絞る。絞ってから引き直さないのは、
 * 全文検索とタグ絞り込みを 1 つのクエリにまとめられないため。取り切れる件数のうちに
 * 絞る形なので、検索の上限より多くの記事が同じタグに付いていると取りこぼしが出る。
 */
async function searchNotes(
  query: D1NoteQueryRepository,
  searchQuery: string,
  tag: string | undefined,
): Promise<NoteListResult> {
  const found = await query.search(searchQuery, SEARCH_LIMIT);
  const notes =
    tag === undefined
      ? found
      : found.filter((note) =>
          note.tags.some((item) => item.toString() === tag),
        );

  // 検索は関連度順にすべて返すので、ページ送りの母数は絞り込み後の件数そのものになる。
  return { notes, total: notes.length };
}

export interface HomePageData {
  /** 公開日の新しい順。 */
  readonly recent: PublicNoteList["notes"];
  /**
   * よく読まれている順。
   *
   * 読まれた回数から並べる (詳しくは domain/note-view/view-ranking)。出発点は投稿日の
   * 重みなので、まだ読まれていない記事も新しい順に候補へ入る。
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
 * よく読まれているノートを読む。
 *
 * 順位付けは D1 に任せる。スコアを対数で持っているおかげで、保存した列をそのまま
 * 降順に並べれば人気順になり、読み出したあとに重みを計算し直す必要がない。
 */
async function loadPopularNotes(
  env: Env,
  query: D1NoteQueryRepository,
): Promise<PublicNoteList["notes"]> {
  const rankedIds = await new D1NoteViewQueryRepository(
    env.D1,
  ).listPopularNoteIds(POPULAR_COUNT);
  if (rankedIds.length === 0) return [];

  // 引き直した行を、順位の並びに戻す。
  const notes = await query.findByIds(rankedIds);
  const byId = new Map<string, Note>(notes.map((note) => [note.id, note]));
  return rankedIds
    .map((id) => byId.get(id))
    .filter((note) => note !== undefined)
    .map((note) => toPublicNote(note));
}
