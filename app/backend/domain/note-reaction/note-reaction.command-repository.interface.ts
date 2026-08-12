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
   * いまの対数スコアを読む。記事が無ければ undefined。
   *
   * スコアの更新は閲覧と同じ列を触る。対数のまま足し引きするには log-sum-exp が要り
   * SQL では書けないので、計算はドメインで行い、ここは書くだけにする。
   */
  findLogScore(noteId: string): Promise<number | undefined>;

  /**
   * いまのスコアと、その記事の出発点を決める投稿日を読む。
   *
   * リアクションを外すときに要る。引いた結果が出発点を割らないよう下限を置くため、
   * スコアだけでなく投稿日も要る (下限は投稿日の重み)。
   */
  findScoreContext(
    noteId: string,
  ): Promise<{ logScore: number; publishedOn: string } | undefined>;

  /** 対数スコアを与えられた値に置き換える。 */
  applyLogScore(noteId: string, logScore: number): Promise<void>;
}
