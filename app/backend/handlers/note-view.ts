import type {
  Note,
  NoteListResult,
  NoteSortField,
  SortDirection,
} from "~/backend/domain/note";

/**
 * 外部 (JSON API / Inertia props) に公開してよい Note の表現。
 * ドメインエンティティをそのまま晒さず、公開可能なフィールドだけに絞る。
 * 識別子は slug (URL 用) のみ公開し、内部 id は出さない。
 */
export interface PublicNote {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly imageUrl: string | null;
  readonly publishedOn: string;
  readonly lastModifiedOn: string;
}

export interface Pagination {
  readonly page: number;
  readonly perPage: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PublicNoteList {
  readonly notes: readonly PublicNote[];
  readonly pagination: Pagination;
}

/** Note エンティティを公開 DTO へ変換する (API / pages 共通)。 */
export function toPublicNote(note: Note): PublicNote {
  return {
    slug: note.slug.toJSON(),
    title: note.title.toJSON(),
    summary: note.summary,
    imageUrl: note.imageUrl?.toJSON() ?? null,
    publishedOn: note.publishedOn.toString({ calendarName: "never" }),
    lastModifiedOn: note.lastModifiedOn.toString({ calendarName: "never" }),
  };
}

/** ページネーション付きの一覧結果を公開 DTO へ変換する。 */
export function toPublicNoteList(
  result: NoteListResult,
  page: number,
  perPage: number,
): PublicNoteList {
  return {
    notes: result.notes.map((note) => toPublicNote(note)),
    pagination: {
      page,
      perPage,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / perPage)),
    },
  };
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

/**
 * クエリ文字列 (page / per-page) を検証済みのページネーションに解決する。
 * 不正・範囲外は安全側 (page>=1, 1<=perPage<=100) に丸める。
 */
export function parsePagination(
  pageParam: string | undefined,
  perPageParam: string | undefined,
): { page: number; perPage: number; limit: number; offset: number } {
  const page = clampInt(pageParam, 1, 1, Number.MAX_SAFE_INTEGER);
  const perPage = clampInt(perPageParam, DEFAULT_PER_PAGE, 1, MAX_PER_PAGE);
  return { page, perPage, limit: perPage, offset: (page - 1) * perPage };
}

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = raw === undefined ? NaN : Number(raw);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** クエリ文字列 (sort-by / order) を検証済みのソート指定に解決する。 */
export function parseNoteSort(
  sortByParam: string | undefined,
  orderParam: string | undefined,
): { sortBy: NoteSortField; direction: SortDirection } {
  const sortBy: NoteSortField =
    sortByParam === "modified" ? "lastModifiedOn" : "publishedOn";
  const direction: SortDirection = orderParam === "asc" ? "asc" : "desc";
  return { sortBy, direction };
}
