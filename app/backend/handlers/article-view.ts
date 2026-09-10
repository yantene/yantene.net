import type {
  Article,
  ArticleListResult,
  ArticleSortField,
  SortDirection,
} from "~/backend/domain/article";

/**
 * 外部 (JSON API / ページ props) に公開してよい Article の表現。
 * ドメインエンティティをそのまま晒さず、公開可能なフィールドだけに絞る。
 * 識別子は slug (URL 用) のみ公開し、内部 id は出さない。
 */
export interface PublicArticle {
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

export interface PublicArticleList {
  readonly articles: readonly PublicArticle[];
  readonly pagination: Pagination;
}

/** Article エンティティを公開 DTO へ変換する (API / pages 共通)。 */
export function toPublicArticle(article: Article): PublicArticle {
  return {
    slug: article.slug.toJSON(),
    title: article.title.toJSON(),
    summary: article.summary,
    imageUrl: article.imageUrl?.toJSON() ?? null,
    publishedOn: article.publishedOn.toString({ calendarName: "never" }),
    lastModifiedOn: article.lastModifiedOn.toString({ calendarName: "never" }),
  };
}

/** ページネーション付きの一覧結果を公開 DTO へ変換する。 */
export function toPublicArticleList(
  result: ArticleListResult,
  page: number,
  perPage: number,
): PublicArticleList {
  const totalPages = Math.max(1, Math.ceil(result.total / perPage));
  return {
    articles: result.articles.map((article) => toPublicArticle(article)),
    pagination: {
      // 範囲外のページ番号は totalPages に丸めて pager と整合させる。
      page: Math.min(page, totalPages),
      perPage,
      total: result.total,
      totalPages,
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

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  // 未指定・空文字は「未指定」として既定値に落とす (Number("") === 0 の罠を避ける)。
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed.length === 0) return fallback;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** クエリ文字列 (sort-by / order) を検証済みのソート指定に解決する。 */
export function parseArticleSort(
  sortByParam: string | undefined,
  orderParam: string | undefined,
): { sortBy: ArticleSortField; direction: SortDirection } {
  const sortBy: ArticleSortField = sortByParam === "modified" ? "lastModifiedOn" : "publishedOn";
  const direction: SortDirection = orderParam === "asc" ? "asc" : "desc";
  return { sortBy, direction };
}
