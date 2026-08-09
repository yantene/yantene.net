export interface INoteViewQueryRepository {
  /**
   * よく読まれている順に、ノートの id を返す。
   *
   * 対数は単調なので、保存した列をそのまま降順に並べれば人気順になる。読み出したあとに
   * 減衰をかけ直す必要はない。まだ読まれていない記事は含まない。
   */
  listPopularNoteIds(limit: number): Promise<readonly string[]>;
}
