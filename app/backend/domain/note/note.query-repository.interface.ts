import type { NoteSlug } from "./note-slug.vo";
import type { Note } from "./note.entity";

/** 一覧の並び替え基準。 */
export type NoteSortField = "publishedOn" | "lastModifiedOn";

/** 並び順。 */
export type SortDirection = "asc" | "desc";

/** ページネーション + ソートのクエリ条件。 */
export interface NoteListQuery {
  /** 取得件数の上限 (1 以上)。 */
  readonly limit: number;
  /** スキップ件数 (0 以上)。 */
  readonly offset: number;
  readonly sortBy: NoteSortField;
  readonly direction: SortDirection;
  /** 指定時、そのタグを持つノートだけに絞り込む。 */
  readonly tag?: string;
}

/** 一覧の取得結果。total は (絞り込み後の) 全件数 (ページネーション用)。 */
export interface NoteListResult {
  readonly notes: readonly Note[];
  readonly total: number;
}

/** タグと、そのタグを持つノート数。 */
export interface NoteTagCount {
  readonly tag: string;
  readonly count: number;
}

export interface INoteQueryRepository {
  findBySlug(slug: NoteSlug): Promise<Note | undefined>;
  list(query: NoteListQuery): Promise<NoteListResult>;
  /**
   * id をまとめて引く。並び順は保証しない (呼び出し側が意図した順に並べ直す)。
   * 見つからない id は結果に現れない。
   */
  findByIds(ids: readonly string[]): Promise<readonly Note[]>;
  /**
   * slug をまとめて引く。並び順は保証しない (呼び出し側が意図した順に並べ直す)。
   * 見つからない slug は結果に現れない。
   */
  findBySlugs(slugs: readonly string[]): Promise<readonly Note[]>;
  /**
   * 全文検索。title / body を対象に関連度 (bm25) 順で最大 limit 件返す。
   * 索引が未構築 (まだ refresh していない) 場合や、実質的なクエリでない場合は空配列。
   */
  search(query: string, limit: number): Promise<readonly Note[]>;
  /** 全タグと各記事数を返す (タグ索引ページ用)。件数降順・タグ昇順。 */
  listTags(): Promise<readonly NoteTagCount[]>;
  /**
   * 全ノートの slug → sourceHash の対応を返す。refresh の変更検出に使う
   * (正本のツリーが返すハッシュと突き合わせる)。
   */
  listSourceHashes(): Promise<ReadonlyMap<string, string>>;
}
