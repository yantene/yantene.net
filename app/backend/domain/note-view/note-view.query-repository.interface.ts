export interface INoteViewQueryRepository {
  /**
   * よく読まれている順に、ノートの id を返す。
   *
   * 対数は単調なので、保存した列をそのまま降順に並べれば人気順になる。読み出したあとに
   * 重みをかけ直す必要はない。
   *
   * まだ読まれていない記事は含まない。スコアの初期値 (0) は全記事に等しく乗る下駄で、
   * 読まれた証ではないため。実際に読まれたかどうかは閲覧数で判じる。
   */
  listPopularNoteIds(limit: number): Promise<readonly string[]>;
}
