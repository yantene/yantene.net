import type { NoteScore } from "./view-ranking";

/**
 * ノートが読まれたことを記録する。
 *
 * 記録するのは回数だけで、読んだ人を特定できる値は受け取らないし、保存もしない。
 */
export interface INoteViewCommandRepository {
  /** いまのスコアと最後に触った日を読む。無い記事なら undefined。 */
  findScore(noteId: string): Promise<NoteScore | undefined>;
  /**
   * 累計を 1 増やし、スコアを与えられた値に置き換える。
   *
   * 減衰の計算はドメイン (scoreAfterView) が行い、ここでは結果を書くだけにする。
   * D1 が冪乗・指数の関数を許していないため、SQL 側では計算できない。
   */
  applyView(noteId: string, score: number, scoredOn: string): Promise<void>;
}
