/**
 * 時刻の目盛り軸まわりの計算。DOM にも WAAPI にも触れない純粋関数だけを置く。
 *
 * 基準となる時刻の取り決めが 1 つある。Celestim のアニメーションは位相 0 が南中
 * (太陽が真上、空が真昼の色) なので、位相 0 は 12:00 を意味する。軸の目盛りと
 * 空の見え方を合わせるには、この対応を崩さないこと。
 */

export const MINUTES_PER_DAY = 1440;

/** 目盛りを打つ間隔 (分)。3 時間ごとに 1 日 8 本。 */
export const TICK_INTERVAL_MINUTES = 180;

/** アニメーションの位相 0 が指す時刻 (分)。Celestim の位相 0 は南中。 */
export const PHASE_ORIGIN_MINUTES = 12 * 60;

/** 1 日分の目盛りの時刻 (分)。0:00 から 3 時間ごと。 */
export function dayTickMinutes(): readonly number[] {
  const count = MINUTES_PER_DAY / TICK_INTERVAL_MINUTES;
  return Array.from({ length: count }, (_, i) => i * TICK_INTERVAL_MINUTES);
}

/**
 * アニメーションの位相 (周期に対する 0〜1) を 1 日内の時刻 (分) に直す。
 *
 * 位相は負にも 1 以上にもなりうる (時間を巻き戻したり、何日も進めたりするため)。
 * 1 日ぶんで畳んでから返す。
 */
export function phaseToMinutes(phase: number): number {
  const raw = PHASE_ORIGIN_MINUTES + phase * MINUTES_PER_DAY;
  return modulo(raw, MINUTES_PER_DAY);
}

/** 経過ミリ秒を、1 日の長さで割った位相に直す。 */
export function elapsedToPhase(elapsedMs: number, dayMs: number): number {
  if (dayMs <= 0) return 0;
  return elapsedMs / dayMs;
}

/** 時刻 (分) を "HH:MM" に整形する。 */
export function formatClock(minutes: number): string {
  const total = Math.floor(modulo(minutes, MINUTES_PER_DAY));
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${pad(hour)}:${pad(minute)}`;
}

/**
 * 軸を横に動かした距離を、時計を進めるべきミリ秒に直す。
 *
 * 軸を右へ引くと過去へ戻る (掴んだ目盛りが指に付いてくる) ので符号を反転させる。
 * 1 日ぶんの幅を渡せないときは、0 を返して時計を動かさない。
 */
export function dragDistanceToElapsed(
  distancePx: number,
  dayWidthPx: number,
  dayMs: number,
): number {
  if (dayWidthPx <= 0) return 0;
  return (-distancePx / dayWidthPx) * dayMs;
}

/** 目盛りの端。Home は 1 日の始まり (0:00)、End は終わり (23:59)。 */
export type DayEdge = "start" | "end";

/*
 * 端へ寄せるときに狙う、分の頭からの僅かなずれ。
 *
 * ちょうど分の頭を狙うと、ミリ秒への換算と位相の計算の誤差で狙いの手前に落ちることがある。
 * 0:00 の手前は前の日の 23:59 なので、Home を押したのに 23:59 と読み上げられてしまう。
 * 分の内側へ少しだけ入れておけば、どちらへ転んでも同じ分に収まる。
 */
const EDGE_MARGIN_MINUTES = 0.001;

/**
 * いまの時刻 (分) から、その日の端までを何分動かせばよいか。符号付きで返す。
 *
 * 端は aria-valuemin / aria-valuemax と同じ 0:00 と 23:59。**日は跨がない。** 跨ぐと
 * 月の満ち欠けまで変わり、「最小値 / 最大値へ寄せる」というスライダーの約束を超えるため。
 * すでにその分にいるときは 0 を返して時計を動かさない。
 */
export function minutesToDayEdge(currentMinutes: number, edge: DayEdge): number {
  const current = modulo(currentMinutes, MINUTES_PER_DAY);
  const targetMinute = edge === "start" ? 0 : MINUTES_PER_DAY - 1;
  if (Math.floor(current) === targetMinute) return 0;
  return targetMinute + EDGE_MARGIN_MINUTES - current;
}

/** 負の値でも正の剰余を返す (JS の % は符号が被除数に従うため)。 */
function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
