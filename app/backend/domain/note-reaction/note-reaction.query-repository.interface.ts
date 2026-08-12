/** ノートに付いている絵文字とその数。 */
export interface NoteReactionCount {
  readonly emoji: string;
  readonly count: number;
}

export interface INoteReactionQueryRepository {
  /**
   * 1 記事に付いているリアクションを、多い順に返す。
   *
   * 0 の行は返さない。取り消しで 0 になった絵文字を並べても意味がないため。
   */
  listByNoteId(noteId: string): Promise<readonly NoteReactionCount[]>;
}
