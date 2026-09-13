import { describe, expect, it } from "vitest";
import { formatLifeEventDate } from "./life-event-date";

describe("formatLifeEventDate", () => {
  it("shows the day when the writer remembered the day", () => {
    expect(formatLifeEventDate("1993-11-18", "day")).toBe("1993 年 11 月 18 日");
  });

  /** 埋めた桁は出さない。月までの出来事を 1 日に起きたことにしない。 */
  it("stops at the month or the year when that is all there is", () => {
    expect(formatLifeEventDate("2012-04", "month")).toBe("2012 年 4 月");
    expect(formatLifeEventDate("2016", "year")).toBe("2016 年");
  });

  it("drops the zero padding", () => {
    expect(formatLifeEventDate("2012-04-01", "day")).toBe("2012 年 4 月 1 日");
  });
});
