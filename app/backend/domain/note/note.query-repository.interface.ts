import type { NoteSlug } from "./note-slug.vo";
import type { NoteTag } from "./note-tag.vo";
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
   * タグの重複数でスコアリングした関連ノートを返す。自分自身は除外し、
   * 重複数の降順 → 公開日の降順 → slug 昇順で並べ、上限 limit 件を返す。
   * tags が空なら空配列。
   */
  findRelated(
    slug: NoteSlug,
    tags: readonly NoteTag[],
    limit: number,
  ): Promise<readonly Note[]>;
  /** 全タグと各記事数を返す (タグ索引ページ用)。件数降順・タグ昇順。 */
  listTags(): Promise<readonly NoteTagCount[]>;
  /**
   * 全ノートの slug → sourceHash の対応を返す。refresh の変更検出に使う
   * (Artifacts のツリーが返すハッシュと突き合わせる)。
   */
  listSourceHashes(): Promise<ReadonlyMap<string, string>>;
}
