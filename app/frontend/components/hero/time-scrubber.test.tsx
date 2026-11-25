import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { advanceDayClock, readDayClockPhase, readDayDurationMs } from "./day-clock";
import { TimeScrubber } from "./time-scrubber";
import { withI18n } from "~/frontend/lib/test-render";

/*
 * 時計の実体は CSS アニメーション (WAAPI) で、happy-dom では動かない。読み書きの口だけを
 * 差し替えて、キーが時計をどれだけ動かすかを見る。
 */
vi.mock("./day-clock", () => ({
  advanceDayClock: vi.fn(),
  readDayClockPhase: vi.fn(),
  readDayDurationMs: vi.fn(),
}));

/** 1 日を 1440 秒にしておくと、1 分 = 1000ms で読める。 */
const DAY_MS = 1440 * 1000;

const renderJa = withI18n("ja");
const renderEn = withI18n("en");

beforeEach(() => {
  vi.mocked(advanceDayClock).mockReset();
  vi.mocked(readDayDurationMs).mockReturnValue(DAY_MS);
  // 位相 0 は南中 (12:00)。
  vi.mocked(readDayClockPhase).mockReturnValue(0);
});

/** キーを押して、既定の動作が止められたかを返す。 */
function press(key: string): boolean {
  const notCancelled = fireEvent.keyDown(screen.getByRole("slider"), { key });
  return !notCancelled;
}

describe("TimeScrubber のキー操作", () => {
  it("Home はその日の 0:00 へ戻す", () => {
    renderJa(<TimeScrubber initialMinutes={720} />);

    expect(press("Home")).toBe(true);

    const [elapsed] = vi.mocked(advanceDayClock).mock.calls[0] ?? [];
    // 12:00 から 12 時間戻す。日は跨がない (跨ぐと月の満ち欠けが変わる)。
    expect(elapsed).toBeCloseTo(-720 * 1000, -1);
  });

  it("End はその日の 23:59 へ進める", () => {
    renderJa(<TimeScrubber initialMinutes={720} />);

    expect(press("End")).toBe(true);

    const [elapsed] = vi.mocked(advanceDayClock).mock.calls[0] ?? [];
    expect(elapsed).toBeCloseTo(719 * 1000, -1);
  });

  /*
   * 動かす量が 0 でも、既定の動作 (ページの末尾へのスクロール) は止める。止めないと、
   * 端にいるときだけページが飛ぶ。
   */
  it("すでに端にいても、ページはスクロールさせない", () => {
    // 位相 0.4999 は 23:59 台。
    vi.mocked(readDayClockPhase).mockReturnValue(0.4999);
    renderJa(<TimeScrubber initialMinutes={1439} />);

    expect(press("End")).toBe(true);
    expect(advanceDayClock).not.toHaveBeenCalled();
  });

  it("扱わないキーは素通しする", () => {
    renderJa(<TimeScrubber initialMinutes={720} />);

    expect(press("a")).toBe(false);
    expect(advanceDayClock).not.toHaveBeenCalled();
  });
});

describe("TimeScrubber の名前", () => {
  // 画面に出ない名前なので訳す (product.md の「読み上げにしか出ない名前は訳す」)。
  it("日本語では「時刻」", () => {
    renderJa(<TimeScrubber initialMinutes={720} />);

    expect(screen.getByRole("slider", { name: "時刻" })).toBeInTheDocument();
  });

  it("英語では Time of day", () => {
    renderEn(<TimeScrubber initialMinutes={720} />);

    expect(screen.getByRole("slider", { name: "Time of day" })).toBeInTheDocument();
  });
});
