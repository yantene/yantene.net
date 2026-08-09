/**
 * 読まれた回数から「いま人気のノート」の順位を出す。
 *
 * 単純な累計では、古くからある記事がいつまでも上位に居座り、順位が動かなくなる。
 * そこで 1 回のアクセスの重みを、時間が経つほど小さくして数える。半減期を過ぎた
 * アクセスは半分の重みになり、そのまた半減期で 4 分の 1 になる (指数減衰)。
 *
 * 結果として古い記事が上位に来ることはある。それは「昔の記事がいまも読まれている」
 * ということなので正しい。公開日の順に並べているわけではない。
 *
 * 減衰はスコアを読むときに当てる。記事ごとに「スコア」と「最後に触った日」を持たせて
 * おけば、経過ぶんを掛けるだけで現在の値が出る。日ごとの履歴を持たなくて済み、定期的に
 * 全記事を減衰させるバッチも要らない (バッチは走らせ損ねると減衰が飛び、二重に走らせると
 * 効きすぎる)。
 */

/** 記事ごとに持っている、減衰前のスコア。 */
export interface NoteScore {
  readonly noteId: string;
  /** 最後に触った時点での重み付き合計。 */
  readonly score: number;
  /**
   * score を最後に触った日 (ISO 日付文字列 "YYYY-MM-DD", UTC)。
   * まだ一度も読まれていなければ null。
   */
  readonly scoredOn: string | null;
}

export interface RankedNoteView {
  readonly noteId: string;
  /** 減衰後のスコア。順位を決めるためだけの値で、表示には使わない。 */
  readonly score: number;
}

export interface ViewRankingOptions {
  /**
   * 重みが半分になるまでの日数。
   *
   * 短いほど直近の勢いを拾い、長いほど落ち着いた人気を映す。記事もアクセスも多くない
   * うちは短くすると数件の差で順位が跳ねるため、やや長めに取る。
   */
  readonly halfLifeDays: number;
  /** 基準日 (この日まで減衰させる)。 */
  readonly today: string;
}

/**
 * 最後に触った日から今日までの経過ぶんを減衰させた、いまのスコア。
 *
 * 基準日より後の日付は経過日数が負になるが、その場合の重みは 1 で頭打ちにする
 * (時刻のずれで未来の日付が入っても、重みが 1 を超えて暴れないようにするため)。
 */
export function decayScore(
  { score, scoredOn }: NoteScore,
  { halfLifeDays, today }: ViewRankingOptions,
): number {
  assertPositiveHalfLife(halfLifeDays);
  if (scoredOn === null || score === 0) return 0;

  const age = daysBetween(scoredOn, today);
  return score * 0.5 ** (Math.max(age, 0) / halfLifeDays);
}

/**
 * 1 回読まれたあとのスコア。
 *
 * 前回からの経過ぶんを減衰させてから 1 を足す。足してから減衰させるのではないのは、
 * いま足したぶんが同じ更新で目減りしてしまわないようにするため。
 */
export function scoreAfterView(
  current: NoteScore,
  options: ViewRankingOptions,
): number {
  return decayScore(current, options) + 1;
}

/**
 * 記事ごとのスコアを、減衰後の高い順に並べる。読まれていない記事は現れない。
 */
export function rankNoteScores(
  scores: readonly NoteScore[],
  options: ViewRankingOptions,
): readonly RankedNoteView[] {
  assertPositiveHalfLife(options.halfLifeDays);

  return scores
    .map((entry) => ({
      noteId: entry.noteId,
      score: decayScore(entry, options),
    }))
    .filter((ranked) => ranked.score > 0)
    .toSorted((a, b) => {
      const byScore = b.score - a.score;
      // 同点は noteId で決める。並びが実行ごとに揺れると、順位が理由もなく入れ替わる。
      return byScore === 0 ? a.noteId.localeCompare(b.noteId) : byScore;
    });
}

function assertPositiveHalfLife(halfLifeDays: number): void {
  if (halfLifeDays <= 0) {
    throw new RangeError(
      `halfLifeDays must be positive: ${String(halfLifeDays)}`,
    );
  }
}

const MILLISECONDS_PER_DAY = 86_400_000;

/** ISO 日付文字列 2 つの間隔を日数で返す (from が古いほど正の値)。 */
function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    throw new RangeError(`invalid date: ${from} / ${to}`);
  }
  return (toMs - fromMs) / MILLISECONDS_PER_DAY;
}
