/**
 * ノートが読まれたことを記録する。
 *
 * 記録するのは回数だけで、読んだ人を特定できる値は受け取らないし、保存もしない。
 */
export interface INoteViewCommandRepository {
  /** いまの対数スコアを読む。記事が無ければ undefined (まだ読まれていない記事は 0)。 */
  findLogScore(noteId: string): Promise<number | undefined>;
  /**
   * 累計を 1 増やし、対数スコアを与えられた値に置き換える。
   *
   * 対数のまま足すには log-sum-exp が要り、SQL では書けないので、計算済みの値を
   * ドメイン (logScoreAfterView) から受け取って書くだけにする。
   */
  applyView(noteId: string, logScore: number): Promise<void>;
}
