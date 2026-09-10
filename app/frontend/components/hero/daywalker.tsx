import CharacterSvg from "~/frontend/assets/yantene-character.svg?react";

type DaywalkerProps = {
  readonly ref?: React.Ref<HTMLDivElement>;
};

/**
 * 地平線の上を歩き続けるやんてね。画面上の位置は動かず、時刻の目盛りのほうが足元を
 * 流れていく。絵はロゴのキャラクター部分そのもの (素材の規約は yantene-character.svg の
 * コメント)。歩いている姿勢で描かれているので手足は動かさず、全体をゆっくり傾けるだけ。
 *
 * 時間を巻き戻しているあいだは、呼び出し側が向きを反転させて来た道を戻らせる。
 */
export function Daywalker({ ref }: DaywalkerProps): React.JSX.Element {
  return (
    <div className="daywalker" aria-hidden="true" ref={ref}>
      <CharacterSvg className="daywalker-svg" />
    </div>
  );
}
