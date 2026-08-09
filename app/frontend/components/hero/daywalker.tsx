import WalkerSvg from "~/frontend/assets/walker.svg?react";

type DaywalkerProps = {
  readonly ref?: React.Ref<HTMLDivElement>;
};

/**
 * 地平線の上を歩き続ける人。画面上の位置は動かず、時刻の目盛りのほうが足元を流れていく。
 *
 * 手足は SVG の中のパーツを CSS で振っている (素材の差し替え規約は walker.svg のコメント)。
 * 時間を巻き戻しているあいだは、呼び出し側が playbackRate を反転させて後ろ歩きにする。
 */
export function Daywalker({ ref }: DaywalkerProps): React.JSX.Element {
  return (
    <div className="daywalker" aria-hidden="true" ref={ref}>
      <WalkerSvg className="daywalker-svg" />
    </div>
  );
}
