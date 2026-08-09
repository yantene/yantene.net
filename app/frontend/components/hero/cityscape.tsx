import CityscapeSvg from "~/frontend/assets/cityscape.svg?react";

/**
 * ヒーローの空 (Celestim) の手前に敷く街並みの線画。
 *
 * SVG を `<img>` ではなくインライン展開しているのは、線の色を currentColor で
 * 受け取るためと、雲のレイヤーだけを CSS で流すため。どちらも外部 SVG では届かない。
 *
 * 地平線 (viewBox の y=340) が下端から `--cityscape-ground` の位置に来るように
 * 敷いてある。歩行者と時刻の目盛りはこの線を基準に置く。
 */
export function Cityscape(): React.JSX.Element {
  return (
    <div className="cityscape" aria-hidden="true">
      {/*
        下端 (地平線) を器の下端に合わせ、器を埋めるまで拡げる。狭い画面では横が
        切れて街の中ほどだけが見えるが、全体を収めようとすると街だけが縮んで、
        歩行者より低くなってしまう。
      */}
      <CityscapeSvg
        className="cityscape-svg"
        preserveAspectRatio="xMidYMax slice"
      />
    </div>
  );
}
