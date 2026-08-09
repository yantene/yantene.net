import { describe, expect, it } from "vitest";
import {
  dayTickMinutes,
  dragDistanceToElapsed,
  elapsedToPhase,
  formatClock,
  MINUTES_PER_DAY,
  phaseToMinutes,
} from "./time-axis";

describe("dayTickMinutes", () => {
  it("3 時間ごとに 1 日 8 本の目盛りを返す", () => {
    expect(dayTickMinutes()).toEqual([0, 180, 360, 540, 720, 900, 1080, 1260]);
  });
});

describe("phaseToMinutes", () => {
  it("位相 0 は南中 (12:00) を指す", () => {
    expect(phaseToMinutes(0)).toBe(720);
  });

  it("位相 0.25 で 6 時間進む", () => {
    expect(phaseToMinutes(0.25)).toBe(1080);
  });

  it("1 日を跨いだら畳んで返す", () => {
    expect(phaseToMinutes(0.5)).toBe(0);
    expect(phaseToMinutes(1)).toBe(720);
    expect(phaseToMinutes(3.5)).toBe(0);
  });

  it("時間を巻き戻した負の位相でも 1 日内に収める", () => {
    expect(phaseToMinutes(-0.5)).toBe(0);
    expect(phaseToMinutes(-0.25)).toBe(360);
    expect(phaseToMinutes(-2)).toBe(720);
  });
});

describe("elapsedToPhase", () => {
  it("経過時間を 1 日の長さで割る", () => {
    expect(elapsedToPhase(144_000, 288_000)).toBe(0.5);
    expect(elapsedToPhase(-72_000, 288_000)).toBe(-0.25);
  });

  it("1 日の長さが取れないときは進めない", () => {
    expect(elapsedToPhase(1000, 0)).toBe(0);
  });
});

describe("formatClock", () => {
  it("HH:MM に整形する", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(545)).toBe("09:05");
    expect(formatClock(1439)).toBe("23:59");
  });

  it("端数は切り捨てる", () => {
    expect(formatClock(59.9)).toBe("00:59");
  });

  it("1 日を超えた値も畳んで整形する", () => {
    expect(formatClock(MINUTES_PER_DAY + 90)).toBe("01:30");
    expect(formatClock(-60)).toBe("23:00");
  });
});

describe("dragDistanceToElapsed", () => {
  const dayWidth = 1300;
  const dayMs = 288_000;

  it("軸を右へ引くと過去へ戻る", () => {
    expect(dragDistanceToElapsed(650, dayWidth, dayMs)).toBe(-144_000);
  });

  it("軸を左へ引くと未来へ進む", () => {
    expect(dragDistanceToElapsed(-1300, dayWidth, dayMs)).toBe(288_000);
  });

  it("幅が測れないときは時計を動かさない", () => {
    expect(dragDistanceToElapsed(100, 0, dayMs)).toBe(0);
  });
});
