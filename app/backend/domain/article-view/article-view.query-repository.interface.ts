export interface INoteViewQueryRepository {
  /**
   * よく読まれている順に、ノートの id を返す。
   *
   * 対数は単調なので、保存した列をそのまま降順に並べれば人気順になる。読み出したあとに
   * 重みをかけ直す必要はない。
   *
   * まだ読まれていない記事も含む。出発点が投稿日の重みなので、読まれていない記事同士
   * でも新しいものが上に来る。
   */
  listPopularNoteIds(limit: number): Promise<readonly string[]>;
}
