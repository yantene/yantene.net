import type { DailyViewCount } from "./view-ranking";

export interface INoteViewQueryRepository {
  /**
   * 指定日以降の日次閲覧数をすべて返す。
   *
   * 減衰をかけた重み付けは呼び出し側 (ドメインの rankNoteViews) が行う。ここで畳まないのは、
   * D1 が冪乗・指数の関数を許していないため。集計対象は日付で切ってあるので、返る行数は
   * (記事数 × 対象日数) が上限になる。
   *
   * @param since この日を含む、それ以降 (ISO 日付文字列 "YYYY-MM-DD")
   */
  listDailyCountsSince(since: string): Promise<readonly DailyViewCount[]>;
}
