import "./celestim.css";

/*
 * 各既定値は celestim.css の `.celestim-sky` が持つ。ここで既定を埋めて style 属性に
 * 書き出すことはしない — CSP (style-src 'self') 下ではブラウザが style 属性ごと
 * 無視するため、既定の描画が inline style に依存していると何も表示されなくなる。
 * props は「CSP の無い環境 (Storybook 等) での上書き」として扱う。
 */
type CelestimProps = {
  /** Duration of one day cycle in seconds (default: 288) */
  readonly dayDuration?: number;
  /** Sidereal month length in days (default: 28) */
  readonly siderealMonth?: number;
  /** Orbit diameter as CSS value (default: "min(100vw, 1200px)") */
  readonly orbitDiameter?: string;
  /** Celestial body size as CSS value (default: "clamp(28px, 5.5vw, 72px)") */
  readonly bodySize?: string;
  /** How far below the container bottom to push the orbit center (default: "60%") */
  readonly horizonDrop?: string;
  /**
   * Brighten the sky so that text drawn on top stays readable at every hour.
   * 空だけを見せる用途では素の色のほうが良いので既定は無効。
   */
  readonly veil?: boolean;
};

export function Celestim({
  dayDuration,
  siderealMonth,
  orbitDiameter,
  bodySize,
  horizonDrop,
  veil = false,
}: CelestimProps = {}): React.JSX.Element {
  const overrides = {
    "--celestim-one-day":
      dayDuration === undefined ? undefined : `${String(dayDuration)}s`,
    "--celestim-sidereal-month":
      siderealMonth === undefined ? undefined : String(siderealMonth),
    "--celestim-orbit-diameter": orbitDiameter,
    "--celestim-body-size": bodySize,
    "--celestim-horizon-drop": horizonDrop,
  };
  const cssVars = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as React.CSSProperties;

  return (
    <div
      className={`celestim-sky${veil ? " celestim-sky-veiled" : ""}`}
      style={Object.keys(cssVars).length > 0 ? cssVars : undefined}
    >
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
