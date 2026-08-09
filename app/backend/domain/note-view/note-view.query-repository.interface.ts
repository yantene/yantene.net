import type { NoteScore } from "./view-ranking";

export interface INoteViewQueryRepository {
  /**
   * 一度でも読まれた記事のスコアをすべて返す。
   *
   * 減衰は読み出したあとに当てるので (D1 が冪乗を許さない)、ここでは並べ替えない。
   * 返る行数は記事数で頭打ちになる。
   */
  listScores(): Promise<readonly NoteScore[]>;
}
