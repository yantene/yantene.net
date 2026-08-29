import type { ReactionEmoji } from "./reaction-emoji.vo";

/**
 * ノートに付いたリアクションの数を書き換える。
 *
 * 誰が押したかは受け取らないし、保存もしない。押した本人を覚えておくのは
 * 読み手のセッション (KV) の役目で、この表には数しか残らない。
 */
export interface INoteReactionCommandRepository {
  /** その絵文字の数を 1 増やす。行が無ければ 1 で作る。 */
  increment(noteId: string, emoji: ReactionEmoji): Promise<void>;

  /**
   * その絵文字の数を 1 減らす。
   *
   * 0 を下回らせない。押していない人が取り消しを投げても数が負にならないようにする
   * (押したかどうかの判定はセッションが持つが、記録が消えている場合もありうる)。
   */
  decrement(noteId: string, emoji: ReactionEmoji): Promise<void>;

  /**
   * その記事の投稿日を読む。記事が無ければ undefined。
   *
   * リアクションを外すときの下限 (出発点 = 投稿日の重み) を出すのに要る。重みそのものを
   * 実装側に作らせないのは、投稿日をどう重みに直すかが順位付けの意味そのものだから。
   */
  findPublishedOn(noteId: string): Promise<string | undefined>;

  /**
   * 対数スコアに重み 1 つぶんを足す。
   *
   * スコアの更新は閲覧と同じ列を触る。受け取るのは足す重み (reactionWeightLog) で、
   * 書き換え後のスコアではない。読んでから書き戻す形にすると、2 手の間に別の書き込みが
   * 挟まったときに片方の加算がまるごと消える。
   */
  addLogScore(noteId: string, weightLog: number): Promise<void>;

  /**
   * 対数スコアから重み 1 つぶんを引く。引ききったら下限に倒す。
   *
   * @param floorLogScore 下限。その記事の出発点 (投稿日の重み) を渡す。理由は
   *   domain/note-view の logScoreAfterReactionRemoved に書いてある。
   */
  subtractLogScore(noteId: string, weightLog: number, floorLogScore: number): Promise<void>;
}
