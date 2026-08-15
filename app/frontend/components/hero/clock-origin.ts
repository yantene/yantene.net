/**
 * ヒーローの時計を「いつから始めるか」を決める。
 *
 * 手を入れないと CSS アニメーションは必ず currentTime 0、つまり南中の満月から始まる。
 * SSR した HTML はハイドレーションより先に描かれるので、開始位置をブラウザ側で動かすと
 * 南中の絵が一度出てから飛ぶ。開始位置は loader が決め、段階クラスとして HTML に載せる
 * (clock-origin.css)。
 *
 * 決め方は乱数ではなく実時刻にしてある。空は JST のいまの時刻を、月は実際の月齢を指す。
 * 現実と一致するのは開いた瞬間だけで、そこから 288 秒で 1 日ぶんの早送りが始まる。
 *
 * DOM にも WAAPI にも触れない。読む時計は引数で受け取る (時計の読み方は home.tsx の
 * loader が決める)。
 */

import { MINUTES_PER_DAY, PHASE_ORIGIN_MINUTES } from "./time-axis";

/**
 * 空が指す時刻の基準。
 *
 * ヒーローの地平線に描いてあるのが東京の街 (cityscape.svg) なので、空はその街に架かって
 * いるものとして扱う。読者の居場所は見ない。`request.cf.timezone` から読者のローカル時刻に
 * 合わせる手もあるが、それでは東京の街の上に別の土地の空が架かる。加えて、そうすると
 * HTML が読者の地理に依存し、共有キャッシュに載せられなくなる。
 *
 * 街の素材を別の土地のものに差し替えるなら、ここも一緒に変えること。
 */
const SITE_TIME_ZONE = "Asia/Tokyo";

/**
 * 時刻の刻み (分)。clock-origin.css の `.clock-minute-*` と対で、片方だけ変えると
 * 存在しないクラスが出る。
 *
 * これ以上細かくしても意味がない。1 日を 288 秒で回しているので、実時間の 1 秒が
 * 世界内の 5 分にあたる。ページが描き終わる頃には 5 分ぶん進んでいる。
 */
const MINUTE_STEP = 5;

/**
 * この空の朔望月 (日)。celestim.css の `--celestim-sidereal-month` と同じ値。
 *
 * 現実の 29.53 日ではなく 28 日なのは、月の公転周期をそこから導いているため。
 * 実際の月齢をこの空へ移すときは、朔望周期に対する割合として渡す。
 */
const CYCLE_DAYS = 28;

/** 平均朔望月 (日)。 */
const SYNODIC_MONTH_DAYS = 29.530588861;

/** 2000-01-06 の平均朔 (Julian Ephemeris Day)。Meeus の朔望計算の k = 0。 */
const MEAN_NEW_MOON_JDE = 2_451_550.09766;

/** Unix epoch (1970-01-01T00:00:00Z) の Julian Day。 */
const UNIX_EPOCH_JD = 2_440_587.5;

const MS_PER_DAY = 86_400_000;

export interface ClockOrigin {
  /** 開いた時点の JST の時刻 (0:00 からの分)。MINUTE_STEP に丸めてある。 */
  readonly minutesOfDay: number;
  /**
   * 月に与える月齢 (日、0 以上 CYCLE_DAYS 未満の整数)。
   *
   * 画面に出る月齢はこれと時刻のずらしの和なので、この値そのものは実際の月齢とは
   * 一致しない。整数に限る理由は clock-origin.css に書いてある。
   */
  readonly moonAgeDay: number;
}

/** loader が返す形。 */
export interface ClockOriginData {
  readonly clockOrigin: ClockOrigin;
}

/**
 * 開始位置を決める。
 *
 * 必ず loader のような I/O の内側から呼ぶこと。Cloudflare Workers は I/O の外の時刻を
 * Unix epoch 0 に固定するため、モジュールスコープで時計を読むと本番の SSR だけが
 * 1970 年になる (current-year.ts に同じ注意がある)。読む時計を引数で受けているのは、
 * 呼ぶ場所を呼び出し側に選ばせるためでもある。
 */
export function resolveClockOrigin(now: Date): ClockOrigin {
  const rounded =
    Math.round(minutesOfDayInSiteZone(now) / MINUTE_STEP) * MINUTE_STEP;

  /*
   * 時計を南中から何日ぶん進めるか。clock-origin.css の `--clock-shift-days` と
   * 符号を反転させただけの同じ値で、片方だけ変えると月齢がずれる。
   *
   * 1 を足すのは、CSS 側が必ず「進める」向きでなければならないため (正の
   * animation-delay ではキーフレームが当たらない。理由は clock-origin.css にある)。
   * 空と太陽と目盛りは 1 日で元に戻るので絵は変わらないが、月だけは 1 日ぶん進む。
   *
   * この進みは月のアニメーションにも掛かる (時計に属するものすべてに同じ絶対時間を
   * 与えるため) ので、その分を月齢から引いておく。引かないと、朝に開くほど月が老けて
   * 見える。
   */
  const shiftDays = (rounded - PHASE_ORIGIN_MINUTES) / MINUTES_PER_DAY + 1;

  /*
   * 月に渡せるのは整数日だけなので、画面に出る月齢は実際の月齢から最大で半日ずれる
   * (この空では 6 度ぶんの離角にあたる)。1 日より細かい月齢を渡す手立ては無い。
   * 時刻のずらしがその端数を占めていて、そちらは動かせないためである。
   */
  const age = (moonAgeDays(now) / SYNODIC_MONTH_DAYS) * CYCLE_DAYS - shiftDays;

  return {
    // 丸めで 24:00 に届くことがあるので、ここで 1 日ぶん畳む。
    minutesOfDay: rounded % MINUTES_PER_DAY,
    moonAgeDay: modulo(Math.round(age), CYCLE_DAYS),
  };
}

/** 開始位置を clock-origin.css のクラス名に直す。 */
export function clockOriginClassName(origin: ClockOrigin): string {
  const hour = Math.floor(origin.minutesOfDay / 60);
  const minute = origin.minutesOfDay % 60;

  return [
    `clock-hour-${String(hour)}`,
    `clock-minute-${String(minute)}`,
    `moon-age-${String(origin.moonAgeDay)}`,
  ].join(" ");
}

/**
 * 直前の朔 (新月) からの経過日数。0 が新月、約 14.8 が満月。
 *
 * 平均朔望月だけで求めると、月の軌道が楕円であるぶん最大 0.6 日ずれる。この空では
 * 新月が日食として出るので、そのずれは「日食の日に日食が出ない」という形で見える。
 * 補正項を入れて分単位まで合わせてある。
 */
export function moonAgeDays(now: Date): number {
  const jd = now.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
  const k = Math.round((jd - MEAN_NEW_MOON_JDE) / SYNODIC_MONTH_DAYS);
  const nearest = newMoonJde(k);
  return jd - (nearest <= jd ? nearest : newMoonJde(k - 1));
}

/**
 * k 番目の朔の時刻 (Julian Ephemeris Day)。
 *
 * Meeus "Astronomical Algorithms" 第 49 章の平均朔に、0.001 日 (1.5 分) 以上の補正項だけを
 * 足したもの。落とした項の合計は 3 分に満たず、この用途では見えない。地球時と世界時の差
 * (現在およそ 70 秒) も同じ理由で無視している。
 */
function newMoonJde(k: number): number {
  const t = k / 1236.85;
  // 地球の軌道離心率の永年変化。
  const eccentricity = 1 - 0.002516 * t;
  const sunAnomaly = toRadians(2.5534 + 29.1053567 * k);
  const moonAnomaly = toRadians(
    201.5643 + 385.81693528 * k + 0.0107582 * t * t,
  );
  const latitudeArgument = toRadians(
    160.7108 + 390.67050284 * k - 0.0016118 * t * t,
  );

  return (
    MEAN_NEW_MOON_JDE +
    SYNODIC_MONTH_DAYS * k +
    0.00015437 * t * t -
    0.4072 * Math.sin(moonAnomaly) +
    0.17241 * eccentricity * Math.sin(sunAnomaly) +
    0.01608 * Math.sin(2 * moonAnomaly) +
    0.01039 * Math.sin(2 * latitudeArgument) +
    0.00739 * eccentricity * Math.sin(moonAnomaly - sunAnomaly) -
    0.00514 * eccentricity * Math.sin(moonAnomaly + sunAnomaly) +
    0.00208 * eccentricity * eccentricity * Math.sin(2 * sunAnomaly) -
    0.00111 * Math.sin(moonAnomaly - 2 * latitudeArgument)
  );
}

/**
 * SITE_TIME_ZONE での 0:00 からの経過分。
 *
 * `hourCycle` に h23 を指定するのは、真夜中を 24 時と出す組み合わせがあるため。
 */
function minutesOfDayInSiteZone(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TIME_ZONE,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const partValue = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return partValue("hour") * 60 + partValue("minute");
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** 負の値でも正の剰余を返す (JS の % は符号が被除数に従うため)。 */
function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
