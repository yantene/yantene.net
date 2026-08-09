/**
 * 読まれた回数から「いま人気のノート」の順位を出す。
 *
 * 単純な累計では、古くからある記事がいつまでも上位に居座り、順位が動かなくなる。
 * そこで 1 回のアクセスの重みを、新しいものほど大きくする。基準日からの経過が半減期
 * 1 つぶん進むごとに、そのとき起きたアクセスの重みは 2 倍になる。古い重みを減らす
 * のではなく新しい重みを増やすので、記録済みの値には二度と触らなくてよい。
 *
 * 結果として古い記事が上位に来ることはある。それは「昔の記事がいまも読まれている」
 * ということなので正しい。公開日の順に並べているわけではない。
 *
 * ## なぜ対数で持つのか
 *
 * 重みは経過に対して指数的に膨らむので、素の値で持つと倍精度でも 85 年ほどで溢れる
 * (半減期 30 日の場合)。対数のまま持てば経過に対して線形にしか増えず、100 万年でも
 * 8.4e6 にしかならない。
 *
 * 対数は単調なので、順序は素の値のときと変わらない。保存した列をそのまま
 * `ORDER BY ... DESC` すれば人気順になり、読み出すときに計算を挟まなくて済む。
 */

/**
 * 重みの基準となる日 (ISO 日付文字列 "YYYY-MM-DD", UTC)。
 *
 * この日に起きたアクセスの重みを 1 とし、以降は半減期ごとに 2 倍になる。全記事で
 * 同じ値を使う限り順序は変わらないので、値そのものに意味はない。
 *
 * ただし **一度動かすと、記録済みのスコアと意味が食い違う**。過去に書いた値は古い
 * 基準で測られたままなので、動かすなら全記事のスコアを捨てること。
 */
export const VIEW_SCORE_EPOCH = "2026-01-01";

/**
 * 重みが 2 倍になるまでの日数 (＝古い側から見た半減期)。
 *
 * 短いほど直近の勢いを拾い、長いほど落ち着いた人気を映す。記事もアクセスも多くない
 * うちは短くすると数件の差で順位が跳ねるため、やや長めに取る。
 *
 * 基準日と同じく、動かすと記録済みの値と意味が食い違う。
 */
export const VIEW_SCORE_HALF_LIFE_DAYS = 30;

/**
 * その日に起きた 1 アクセスの重み (対数)。
 *
 * 基準日より前なら負になるが、それで構わない。対数の世界では 0 が「重み 1」であって、
 * 負は「1 より軽い」を意味するだけで、順序は保たれる。
 */
export function viewWeightLog(viewedOn: string): number {
  return (
    (daysBetween(VIEW_SCORE_EPOCH, viewedOn) / VIEW_SCORE_HALF_LIFE_DAYS) *
    Math.LN2
  );
}

/**
 * 1 回読まれたあとのスコア (対数)。
 *
 * 対数のまま足すために log-sum-exp を使う。大きいほうを括り出してから足すので、
 * `Math.exp` の引数が 0 以下に収まり、途中の計算でも溢れない。
 *
 * @param currentLogScore いまのスコア。まだ読まれていなければ null
 */
export function logScoreAfterView(
  currentLogScore: number | null,
  viewedOn: string,
): number {
  const weight = viewWeightLog(viewedOn);
  if (currentLogScore === null) return weight;

  const larger = Math.max(currentLogScore, weight);
  const smaller = Math.min(currentLogScore, weight);
  return larger + Math.log1p(Math.exp(smaller - larger));
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
