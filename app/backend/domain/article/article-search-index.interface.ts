import type { NoteSlug } from "./note-slug.vo";

/** 検索インデックスに登録する 1 ノートのテキスト。 */
export interface NoteSearchDocument {
  readonly slug: NoteSlug;
  readonly title: string;
  /** 本文のプレーンテキスト (MDAST から抽出)。 */
  readonly body: string;
}

/**
 * 全文検索インデックスの書き込み口 (Command)。読み取り (検索) は
 * INoteQueryRepository.search が担う。実装 (infra) はどの検索基盤を使うかを隠蔽する。
 */
export interface INoteSearchIndex {
  /** ノートを索引に登録する (既存があれば置き換え)。 */
  index(document: NoteSearchDocument): Promise<void>;
  /** ノートを索引から削除する。 */
  remove(slug: NoteSlug): Promise<void>;
}
