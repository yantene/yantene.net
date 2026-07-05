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
}

/** 一覧の取得結果。total は絞り込み前の全件数 (ページネーション用)。 */
export interface NoteListResult {
  readonly notes: readonly Note[];
  readonly total: number;
}

export interface INoteQueryRepository {
  findBySlug(slug: NoteSlug): Promise<Note | undefined>;
  list(query: NoteListQuery): Promise<NoteListResult>;
  /**
   * 全ノートの slug → sourceHash の対応を返す。refresh の変更検出に使う
   * (Artifacts のツリーが返すハッシュと突き合わせる)。
   */
  listSourceHashes(): Promise<ReadonlyMap<string, string>>;
}
