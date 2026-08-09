/**
 * 読まれた回数から「いま人気のノート」の順位を出す。
 *
 * 単純な累計では、古くからある記事がいつまでも上位に居座り、順位が動かなくなる。
 * そこで 1 回のアクセスの重みを、時間が経つほど小さくして数える。半減期を過ぎた
 * アクセスは半分の重みになり、そのまた半減期で 4 分の 1 になる (指数減衰)。
 *
 * 結果として古い記事が上位に来ることはある。それは「昔の記事がいまも読まれている」
 * ということなので正しい。公開日の順に並べているわけではない。
 */

/** 1 日ぶんの閲覧数。 */
export interface DailyViewCount {
  readonly noteId: string;
  /** 集計日 (ISO 日付文字列 "YYYY-MM-DD", UTC)。 */
  readonly viewedOn: string;
  readonly viewCount: number;
}

export interface RankedNoteView {
  readonly noteId: string;
  /** 減衰後の重み付き合計。順位を決めるためだけの値で、表示には使わない。 */
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
  /** 集計の基準日 (この日を経過 0 日とする)。 */
  readonly today: string;
}

/**
 * 日次の閲覧数を、時間減衰をかけた順位に畳む。
 *
 * 基準日より後の日付は経過日数が負になるが、その場合の重みは 1 で頭打ちにする
 * (時刻のずれで未来の行が現れても、重みが 1 を超えて暴れないようにするため)。
 */
export function rankNoteViews(
  dailyCounts: readonly DailyViewCount[],
  { halfLifeDays, today }: ViewRankingOptions,
): readonly RankedNoteView[] {
  if (halfLifeDays <= 0) {
    throw new RangeError(
      `halfLifeDays must be positive: ${String(halfLifeDays)}`,
    );
  }

  const scores = new Map<string, number>();
  for (const daily of dailyCounts) {
    const age = daysBetween(daily.viewedOn, today);
    const weight = 0.5 ** (Math.max(age, 0) / halfLifeDays);
    scores.set(
      daily.noteId,
      (scores.get(daily.noteId) ?? 0) + daily.viewCount * weight,
    );
  }

  return [...scores]
    .map(([noteId, score]) => ({ noteId, score }))
    .filter((ranked) => ranked.score > 0)
    .toSorted((a, b) => {
      const byScore = b.score - a.score;
      // 同点は noteId で決める。並びが実行ごとに揺れると、順位が理由もなく入れ替わる。
      return byScore === 0 ? a.noteId.localeCompare(b.noteId) : byScore;
    });
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
