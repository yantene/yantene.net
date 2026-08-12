import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationProgress } from "./navigation-progress";

/** navigation-progress.tsx の APPEAR_DELAY_MS と揃えてある。 */
const APPEAR_DELAY_MS = 150;

const LABEL = "読み込み中";

/** 帯が出ているか。読み上げ用の入れ物は常にあるので、中の帯で判定する。 */
function isBarShown(): boolean {
  return document.querySelector(".navigation-progress-bar") !== null;
}

describe("NavigationProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("遷移していないときは帯を出さない", () => {
    render(<NavigationProgress isPending={false} label={LABEL} />);

    expect(isBarShown()).toBe(false);
  });

  it("読み上げ用の入れ物は遷移していなくても置いておく", () => {
    // 入れ物ごと現れる作りだと、role="status" の変化を拾えない読み手がいる。
    render(<NavigationProgress isPending={false} label={LABEL} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("待ちの間に終わる遷移では帯を出さない", () => {
    render(<NavigationProgress isPending label={LABEL} />);

    act(() => {
      vi.advanceTimersByTime(APPEAR_DELAY_MS - 1);
    });

    expect(isBarShown()).toBe(false);
  });

  it("待ちを越えたら帯と文言を出す", () => {
    render(<NavigationProgress isPending label={LABEL} />);

    act(() => {
      vi.advanceTimersByTime(APPEAR_DELAY_MS);
    });

    expect(isBarShown()).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent(LABEL);
  });

  it("遷移が終わったら帯を消す", () => {
    const { rerender } = render(<NavigationProgress isPending label={LABEL} />);
    act(() => {
      vi.advanceTimersByTime(APPEAR_DELAY_MS);
    });

    rerender(<NavigationProgress isPending={false} label={LABEL} />);

    expect(isBarShown()).toBe(false);
  });

  it("次の遷移では待ちを数え直す", () => {
    // 前の遷移で経った時間が残っていると、2 回目以降が待ちなしで出てちらつく。
    const { rerender } = render(<NavigationProgress isPending label={LABEL} />);
    act(() => {
      vi.advanceTimersByTime(APPEAR_DELAY_MS);
    });
    rerender(<NavigationProgress isPending={false} label={LABEL} />);

    rerender(<NavigationProgress isPending label={LABEL} />);
    act(() => {
      vi.advanceTimersByTime(APPEAR_DELAY_MS - 1);
    });

    expect(isBarShown()).toBe(false);
  });
});
