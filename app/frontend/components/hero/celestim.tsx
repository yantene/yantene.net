import "./celestim.css";

type CelestimProps = {
  /** Duration of one day cycle in seconds (default: 4.8) */
  readonly dayDuration?: number;
  /** Sidereal month length in days (default: 28) */
  readonly siderealMonth?: number;
  /** Orbit diameter as CSS value (default: "min(100vw, 1200px)") */
  readonly orbitDiameter?: string;
  /** Celestial body size as CSS value (default: "clamp(24px, 5vw, 60px)") */
  readonly bodySize?: string;
};

export function Celestim({
  dayDuration = 4.8,
  siderealMonth = 28,
  orbitDiameter = "min(100vw, 1200px)",
  bodySize = "clamp(24px, 5vw, 60px)",
}: CelestimProps = {}): React.JSX.Element {
  const cssVars = {
    "--celestim-one-day": `${String(dayDuration)}s`,
    "--celestim-sidereal-month": String(siderealMonth),
    "--celestim-orbit-diameter": orbitDiameter,
    "--celestim-body-size": bodySize,
  } as React.CSSProperties;

  return (
    <div className="celestim-sky" style={cssVars}>
      <div className="celestim-turntable celestim-solar-turntable">
        <div className="celestim-sun celestim-celestial-body" />
      </div>
      <div className="celestim-turntable celestim-lunar-turntable">
        <div className="celestim-moon celestim-moon-light celestim-moon-light-left celestim-celestial-body" />
        <div className="celestim-moon celestim-moon-light celestim-moon-light-right celestim-celestial-body" />
        <div className="celestim-moon celestim-moon-shade-left celestim-celestial-body" />
        <div className="celestim-moon celestim-moon-shade-right celestim-celestial-body" />
      </div>
    </div>
  );
}
