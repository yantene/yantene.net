import { describe, expect, it } from "vitest";
import { spanStamp } from "./date-span";

describe("spanStamp", () => {
  it("shows a point as written", () => {
    expect(spanStamp("2011", null)).toBe("2011");
    expect(spanStamp("2011-06-04", null)).toBe("2011-06-04");
  });

  it.each([
    ["2012-08-14", "2012-08-18", "2012-08-14 〜 18"],
    ["2012-08-14", "2012-09-02", "2012-08-14 〜 09-02"],
    ["2012-12-28", "2013-01-03", "2012-12-28 〜 2013-01-03"],
    ["2011", "2013", "2011 〜 2013"],
    ["2024-06", "2024-09", "2024-06 〜 09"],
  ])("folds the parts shared with the start: %s 〜 %s", (from, until, stamp) => {
    expect(spanStamp(from, until)).toBe(stamp);
  });
});
