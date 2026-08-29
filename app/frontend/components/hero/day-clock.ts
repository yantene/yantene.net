/**
 * ヒーローの時計 (空・太陽・月・雲・目盛り) を進退させる。
 *
 * 動かす手段に Web Animations API を選んでいる理由は、連続値の受け渡しにある (ADR 0008)。
 * `Animation.currentTime` は style を一切経由しないので、style 属性にも CSS 変数にも
 * 触らずに位相だけを飛ばせる。`style-src` は数式のために緩めてあるが (ADR 0019)、
 * 見た目の可変軸を静的なクラスの段階で持つ書き方はそのまま続けている。
 *
 * 開始位置 (どの時刻・どの月齢から始めるか) はここでは決めない。SSR した HTML が
 * 描かれてからでは南中の絵が一度出てしまうので、loader が決めて段階クラスで渡す
 * (clock-origin.ts / clock-origin.css)。
 *
 * 進め方は「全部に同じ増分を与える」だけでよい。空も太陽も月も雲も目盛りも、同じ
 * document timeline 上の linear infinite アニメーションとして、1 日の長さ
 * (--day-cycle) を基準に定義してある。同じ量だけずらせば、太陽と月の離角も月相も
 * 崩れない。celestim.css が「時計を 14 日進める」という 1 つの操作で満月から
 * 始めているのと同じ理屈を、連続値に広げたものになっている。
 *
 * `currentTime` は再生中でも一時停止中でも読み書きでき、再生中に代入しても走ったまま
 * 位相だけ飛ぶ。そのため prefers-reduced-motion で止めた状態でも同じコードで操作できる。
 */

import { elapsedToPhase } from "./time-axis";

/**
 * 時計に属するアニメーションの keyframes 名。
 *
 * 名前で絞るのは、歩行者の手足のように「時計とは無関係だが同じ木の中で動いている」
 * アニメーションを巻き込まないため。CSS 側で keyframes の名前を変えたら、ここも direct に
 * 追随させること (名前が一致しないと、その要素だけ時間が進まなくなる)。
 */
const clockAnimationNames: ReadonlySet<string> = new Set([
  "sky-color-cycle",
  "celestim-veiled-sky-cycle",
  "celestim-revolution",
  "celestim-moon-light-left-phases",
  "celestim-moon-light-right-phases",
  "celestim-moon-shade-left-phases",
  "celestim-moon-shade-right-phases",
  "cityscape-cloud-drift",
  "time-axis-scroll",
]);

/** 位相を読む基準にするアニメーション。周期がちょうど 1 日のものを選ぶ。 */
const PHASE_REFERENCE_NAME = "time-axis-scroll";

/** 時計をまとめて進める (負の値で巻き戻す)。 */
export function advanceDayClock(deltaMs: number): void {
  if (deltaMs === 0) return;
  const animations = clockAnimations();
  const lift = liftToStayPositive(animations, deltaMs);

  for (const animation of animations) {
    const current = currentTimeOf(animation);
    if (current === null) continue;
    animation.currentTime = current + deltaMs + lift;
  }
}

/**
 * 巻き戻して 0 を割りそうなとき、何ミリ秒ぶん底上げすればよいかを返す。
 *
 * currentTime が負に入ると、アニメーションは「まだ始まっていない」ものとして扱われる。
 * fill-mode は none なので、その区間ではキーフレームが一切適用されず、空の色は抜け、
 * 天体も目盛りも止まる。つまり手当てをしないと、ページを開いた時刻より前には遡れない。
 *
 * 底上げする量は loopCycleMs() の倍数にする。そこだけずらしても絵は変わらない。
 *
 * 開始位置ぶんの負の animation-delay (clock-origin.css) が入っているので、実際に
 * キーフレームが外れる境目は 0 ではなく delay の位置にある。ここを 0 のままにして
 * あるのは、早めに底上げしても周期の倍数である限り絵が変わらないためである。
 */
function liftToStayPositive(animations: readonly Animation[], deltaMs: number): number {
  const cycle = loopCycleMs();
  if (cycle <= 0) return 0;

  let lowest = Infinity;
  for (const animation of animations) {
    const current = currentTimeOf(animation);
    if (current !== null) lowest = Math.min(lowest, current + deltaMs);
  }
  if (!Number.isFinite(lowest) || lowest >= 0) return 0;
  return Math.ceil(-lowest / cycle) * cycle;
}

/**
 * 時計に属するアニメーションが揃って元の位相に戻る周期 (1 日 × 朔望月)。
 *
 * この長さだけ進めると、空と太陽と目盛りは朔望月ぶん、月の公転はそれより 1 回少なく、
 * 月相はちょうど 1 回、雲は 4 日周期ぶん、いずれも整数回まわって同じ絵に戻る。
 * だからこの倍数で底上げしても、月相を含めて見た目は変わらない。
 */
function loopCycleMs(): number {
  const sky = document.querySelector(".celestim-sky");
  if (sky === null) return 0;

  const raw = getComputedStyle(sky).getPropertyValue("--celestim-sidereal-month");
  const months = Number(raw.trim());
  const day = readDayDurationMs();
  if (!Number.isFinite(months) || months <= 0 || day <= 0) return 0;
  return day * months;
}

/**
 * 時計がいま指している位相 (1 日を 1 とした値) を読む。
 *
 * 位相 0 は南中。何日ぶん進んでいるかは畳まずそのまま返すので、時刻に直すときは
 * time-axis.ts の phaseToMinutes に渡すこと。
 *
 * currentTime をそのまま使えないのは、開始位置が負の animation-delay で与えられて
 * いるため (clock-origin.css)。currentTime は delay を含まず必ず 0 から始まるので、
 * 差し引かないと「ページを開いてからの経過時間」しか読めない。
 */
export function readDayClockPhase(): number {
  const reference = clockAnimations().find(
    (animation) => animationNameOf(animation) === PHASE_REFERENCE_NAME,
  );
  if (!reference) return 0;

  const current = currentTimeOf(reference);
  if (current === null) return 0;
  return elapsedToPhase(current - delayOf(reference), durationOf(reference));
}

/** 1 日ぶんの長さ (ミリ秒) を、実際に動いているアニメーションから読む。 */
export function readDayDurationMs(): number {
  const reference = clockAnimations().find(
    (animation) => animationNameOf(animation) === PHASE_REFERENCE_NAME,
  );
  return reference ? durationOf(reference) : 0;
}

function clockAnimations(): readonly Animation[] {
  // getAnimations は SSR には無い。呼び出し側が effect 内でしか使わない前提だが、
  // 念のため存在を確かめてから触る。
  if (typeof document === "undefined" || !("getAnimations" in document)) {
    return [];
  }
  return document
    .getAnimations()
    .filter((animation) => clockAnimationNames.has(animationNameOf(animation) ?? ""));
}

/** CSS アニメーションなら keyframes 名を返す (JS 生成のアニメーションは null)。 */
function animationNameOf(animation: Animation): string | null {
  if (!("animationName" in animation)) return null;
  const name: unknown = (animation as CSSAnimation).animationName;
  return typeof name === "string" ? name : null;
}

/**
 * 現在位置をミリ秒で返す。
 *
 * currentTime は CSSNumericValue にもなりうる型だが、実際に返るのは数値。
 * 数値でないときは触らない (誤った値で時計を飛ばすより、動かないほうがましなため)。
 */
function currentTimeOf(animation: Animation): number | null {
  const value: unknown = animation.currentTime;
  return typeof value === "number" ? value : null;
}

/** 1 周期の長さをミリ秒で返す。取れなければ 0。 */
function durationOf(animation: Animation): number {
  const duration: unknown = animation.effect?.getComputedTiming().duration;
  return typeof duration === "number" ? duration : 0;
}

/** animation-delay をミリ秒で返す。開始位置ぶんの負の値が入っている。 */
function delayOf(animation: Animation): number {
  const delay: unknown = animation.effect?.getComputedTiming().delay;
  return typeof delay === "number" ? delay : 0;
}
