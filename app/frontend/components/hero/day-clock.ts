/**
 * ヒーローの時計 (空・太陽・月・雲・目盛り) を進退させる。
 *
 * 動かす手段に Web Animations API を選んでいる理由は CSP にある。このサイトは
 * `style-src 'self'` で inline style が効かない (ADR 0011) ため、連続値を style 属性や
 * CSS 変数で渡す手が使えない。`Animation.currentTime` は style を一切経由しないので、
 * CSP と関係なく動かせる。
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
  for (const animation of clockAnimations()) {
    const current = currentTimeOf(animation);
    if (current === null) continue;
    animation.currentTime = current + deltaMs;
  }
}

/**
 * 時計がいま指している位相 (1 日を 1 とした値) を読む。
 *
 * 位相 0 は南中。何日ぶん進んでいるかは畳まずそのまま返すので、時刻に直すときは
 * time-axis.ts の phaseToMinutes に渡すこと。
 */
export function readDayClockPhase(): number {
  const reference = clockAnimations().find(
    (animation) => animationNameOf(animation) === PHASE_REFERENCE_NAME,
  );
  if (!reference) return 0;

  const current = currentTimeOf(reference);
  if (current === null) return 0;
  return elapsedToPhase(current, durationOf(reference));
}

/** 1 日ぶんの長さ (ミリ秒) を、実際に動いているアニメーションから読む。 */
export function readDayDurationMs(): number {
  const reference = clockAnimations().find(
    (animation) => animationNameOf(animation) === PHASE_REFERENCE_NAME,
  );
  return reference ? durationOf(reference) : 0;
}

/** 歩行者を進行方向に合わせて前進・後退させる。 */
export function setWalkDirection(root: Element, isBackward: boolean): void {
  const animations = root.getAnimations({ subtree: true });
  for (const animation of animations) {
    if (clockAnimationNames.has(animationNameOf(animation) ?? "")) continue;
    animation.playbackRate = isBackward ? -1 : 1;
  }
}

function clockAnimations(): readonly Animation[] {
  // getAnimations は SSR には無い。呼び出し側が effect 内でしか使わない前提だが、
  // 念のため存在を確かめてから触る。
  if (typeof document === "undefined" || !("getAnimations" in document)) {
    return [];
  }
  return document
    .getAnimations()
    .filter((animation) =>
      clockAnimationNames.has(animationNameOf(animation) ?? ""),
    );
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
