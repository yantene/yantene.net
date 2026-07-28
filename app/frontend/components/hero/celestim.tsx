/*
 * 設定値はすべて celestim.css の `.celestim-sky` が CSS 変数として持つ。
 * inline style で渡す手は使えない — CSP (style-src 'self') 下ではブラウザが
 * style 属性ごと無視するため、本番でだけ設定が消えて空も天体も出なくなる。
 * 可変にしたい軸はクラスの段階として CSS 側に用意する。
 */
/** 全周期を短時間で見たいとき (主に Storybook) 用の速度違い。 */
type CelestimSpeed = "normal" | "fast" | "slow";

function speedClass(speed: CelestimSpeed): string {
  if (speed === "fast") return " celestim-sky-fast";
  if (speed === "slow") return " celestim-sky-slow";
  return "";
}

type CelestimProps = {
  /** Length of one day cycle (default: "normal" = 288s) */
  readonly speed?: CelestimSpeed;
  /**
   * Brighten the sky so that text drawn on top stays readable at every hour.
   * 空だけを見せる用途では素の色のほうが良いので既定は無効。
   */
  readonly veil?: boolean;
};

export function Celestim({
  speed = "normal",
  veil = false,
}: CelestimProps = {}): React.JSX.Element {
  const className = `celestim-sky${veil ? " celestim-sky-veiled" : ""}${speedClass(speed)}`;

  return (
    <div className={className}>
      <div className="celestim-turntable celestim-lunar-turntable">
        <div className="celestim-moon celestim-moon-light celestim-moon-light-left celestim-celestial-body" />
        <div className="celestim-moon celestim-moon-light celestim-moon-light-right celestim-celestial-body" />
        <div className="celestim-moon celestim-moon-shade-left celestim-celestial-body" />
        <div className="celestim-moon celestim-moon-shade-right celestim-celestial-body" />
      </div>
      {/*
        太陽は月より手前。両者は周期的に重なるが、月の影は空と同色で塗る実装なので
        月が手前だと重なった瞬間に太陽が消える。
      */}
      <div className="celestim-turntable celestim-solar-turntable">
        <div className="celestim-sun celestim-celestial-body" />
      </div>
    </div>
  );
}
