import type { ArticleSlug } from "./article-slug.vo";
import type { Article } from "./article.entity";

/** 一覧の並び替え基準。 */
export type ArticleSortField = "publishedOn" | "lastModifiedOn";

/** 並び順。 */
export type SortDirection = "asc" | "desc";

/** ページネーション + ソートのクエリ条件。 */
export interface ArticleListQuery {
  /** 取得件数の上限 (1 以上)。 */
  readonly limit: number;
  /** スキップ件数 (0 以上)。 */
  readonly offset: number;
  readonly sortBy: ArticleSortField;
  readonly direction: SortDirection;
}

/** 一覧の取得結果。total は全件数 (ページネーション用)。 */
export interface ArticleListResult {
  readonly articles: readonly Article[];
  readonly total: number;
}

export interface IArticleQueryRepository {
  findBySlug(slug: ArticleSlug): Promise<Article | undefined>;
  list(query: ArticleListQuery): Promise<ArticleListResult>;
  /**
   * id をまとめて引く。並び順は保証しない (呼び出し側が意図した順に並べ直す)。
   * 見つからない id は結果に現れない。
   */
  findByIds(ids: readonly string[]): Promise<readonly Article[]>;
  /**
   * slug をまとめて引く。並び順は保証しない (呼び出し側が意図した順に並べ直す)。
   * 見つからない slug は結果に現れない。
   */
  findBySlugs(slugs: readonly string[]): Promise<readonly Article[]>;
  /**
   * 全文検索。title / body を対象に関連度 (bm25) 順で最大 limit 件返す。
   * 索引が未構築 (まだ refresh していない) 場合や、実質的なクエリでない場合は空配列。
   */
  search(query: string, limit: number): Promise<readonly Article[]>;
  /**
   * 全記事の slug → sourceHash の対応を返す。refresh の変更検出に使う
   * (コンテンツリポジトリのツリーが返すハッシュと突き合わせる)。
   */
  listSourceHashes(): Promise<ReadonlyMap<string, string>>;
}
