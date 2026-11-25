import { afterEach, describe, expect, it, vi } from "vitest";
import { reserveScrollbarGutter } from "./scrollbar-gutter";

const ATTRIBUTE = "data-modal-gutter";

/** スクロールバーの幅を決める。`innerWidth` との差がそれになる。 */
function withScrollbar(width: number): void {
  vi.spyOn(globalThis, "innerWidth", "get").mockReturnValue(1024);
  vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1024 - width);
}

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute(ATTRIBUTE);
});

describe("reserveScrollbarGutter", () => {
  it("スクロールバーが出ていれば、その場所を空けておく", () => {
    withScrollbar(15);

    reserveScrollbarGutter();

    expect(document.documentElement).toHaveAttribute(ATTRIBUTE);
  });

  /*
   * 出ていないページで空けると、今度は空けた幅のぶん中身が逆へ寄る。
   * スクロールバーが画面に重なる環境 (幅 0) も同じ。
   */
  it("スクロールバーが出ていなければ空けない", () => {
    withScrollbar(0);

    reserveScrollbarGutter();

    expect(document.documentElement).not.toHaveAttribute(ATTRIBUTE);
  });

  it("返した関数で印を降ろす", () => {
    withScrollbar(15);

    const release = reserveScrollbarGutter();
    release();

    expect(document.documentElement).not.toHaveAttribute(ATTRIBUTE);
  });
});
