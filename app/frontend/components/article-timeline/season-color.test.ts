import { describe, expect, it } from "vitest";
import { seasonDotClass } from "./season-color";

describe("seasonDotClass", () => {
  it("公開月ごとに異なるクラスを返す", () => {
    expect(seasonDotClass("2025-01-15")).toBe("season-dot-m01");
    expect(seasonDotClass("2025-05-08")).toBe("season-dot-m05");
    expect(seasonDotClass("2025-12-31")).toBe("season-dot-m12");
  });

  it("同じ月なら日が違っても同じクラスになる", () => {
    expect(seasonDotClass("2025-04-02")).toBe(seasonDotClass("2024-04-21"));
  });

  it("時刻付きの ISO 表記でも月を読める", () => {
    expect(seasonDotClass("2025-07-04T12:34:56Z")).toBe("season-dot-m07");
  });

  it("読めない値でも描画を落とさず既定のクラスに落とす", () => {
    expect(seasonDotClass("")).toBe("season-dot-m01");
    expect(seasonDotClass("not-a-date")).toBe("season-dot-m01");
    // 範囲外の月は日付として不正なので既定に倒す。
    expect(seasonDotClass("2025-13-01")).toBe("season-dot-m01");
    expect(seasonDotClass("2025-00-01")).toBe("season-dot-m01");
  });
});
