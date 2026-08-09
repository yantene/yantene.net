/**
 * ノートが読まれたことを記録する。
 *
 * 記録するのは「どの記事が、いつ (日単位で)、何回読まれたか」だけで、読んだ人を
 * 特定できる値は受け取らないし、保存もしない。
 */
export interface INoteViewCommandRepository {
  /**
   * 指定した日の閲覧数を 1 増やす。同じ日に何度呼ばれても行は増えず、数だけが増える。
   *
   * @param noteId 対象のノート
   * @param viewedOn 集計日 (ISO 日付文字列 "YYYY-MM-DD", UTC)
   */
  increment(noteId: string, viewedOn: string): Promise<void>;
}
