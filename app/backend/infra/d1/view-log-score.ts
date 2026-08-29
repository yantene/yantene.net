import { type SQL, sql } from "drizzle-orm";
import { notes } from "~/backend/infra/d1/schema";

/**
 * 対数スコア (notes.view_log_score) の足し引きを、SQL の式として組む。
 *
 * ドメイン (domain/note-view/view-ranking) が JS で定義している log-sum-exp と同じものを
 * SQL で書き直したもの。読んでから書き戻す 2 手にすると、その間に別の閲覧やリアクションが
 * 挟まったときに、後から書いたほうが先の加算を丸ごと上書きして消してしまう。SQLite に
 * ln / exp / max があるので、今の値から新しい値を作るところまで 1 文に収められる。
 *
 * 足す重みそのものはここでは決めない。日付から重みを出すのは順位付けの意味を決める仕事で、
 * ドメインに置いてある。ここは受け取った値を対数のまま足し引きするだけにする。
 */

/**
 * いまのスコアに重み 1 つぶんを足した値の式 (log-sum-exp)。
 *
 * 大きいほうを括り出してから足すので、exp の引数が 0 以下に収まり、途中で溢れない。
 * ドメイン側は log1p を使うが SQLite に相当する関数が無いので ln(1 + x) の形で書く。
 * 倍精度の最後の 1 ビットまで一致することは view-log-score.test.ts が固定している。
 */
export function scoreWithWeightAdded(weightLog: number): SQL<number> {
  const score = notes.viewLogScore;
  const larger = sql`max(${score}, ${weightLog})`;

  return sql`${larger} + ln(exp(${score} - ${larger}) + exp(${weightLog} - ${larger}))`;
}

/**
 * いまのスコアから重み 1 つぶんを引いた値の式 (log-sub-exp)。
 *
 * 引く側が引かれる側以上だと素の値が 0 以下になり、対数では表せない。SQLite の ln は
 * そこで NULL を返し、NULL は max も飲み込む (max(NULL, x) は NULL) ので、素直に書くと
 * 列に NULL が入って壊れる。NULL はまとめて下限へ倒す。
 *
 * 場合分けを `CASE WHEN score > weight` で書かないのは、それでは足りないため。差がごく
 * 小さいと exp(weight - score) がちょうど 1.0 に丸まって ln(0) を踏むし、逆に差が大きすぎる
 * と exp が Infinity になって ln(-Infinity) を踏む。どちらも NULL になるので、条件で
 * 避けるのではなく NULL を受け止める。
 *
 * 下限そのものが要る理由はドメイン側 (logScoreAfterReactionRemoved) に書いてある。
 *
 * @param floorLogScore 下限。この記事の出発点 (投稿日の重み) を渡す。
 */
export function scoreWithWeightRemoved(weightLog: number, floorLogScore: number): SQL<number> {
  const score = notes.viewLogScore;
  const removed = sql`${score} + ln(1 - exp(${weightLog} - ${score}))`;

  return sql`max(ifnull(${removed}, ${floorLogScore}), ${floorLogScore})`;
}
