import type { ContentRef } from "~/backend/domain/shared";

/**
 * コンテンツが読まれたことを記録する。
 *
 * 記録するのは回数だけで、読んだ人を特定できる値は受け取らないし、保存もしない。
 */
export interface IContentViewCommandRepository {
  /**
   * 累計を 1 増やし、対数スコアに重み 1 つぶんを足す。
   *
   * 受け取るのは足す重み (viewWeightLog) であって、書き換え後のスコアではない。
   * いまのスコアを読んでから書き戻す形にすると、2 手の間に別の書き込みが挟まったときに
   * 片方の加算がまるごと消える。今の値に足すところまで実装側に任せる。
   *
   * 指す先が無ければ何も起きない。
   */
  addView(content: ContentRef, weightLog: number): Promise<void>;
}
