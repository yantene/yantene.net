import { describe, expect, it } from "vitest";
import { HistoryDate, InvalidHistoryDateError } from "./history-date.vo";

describe("HistoryDate", () => {
  /*
   * ⚠️ YAML は精度によって型を変えてくる。`2011` は数、`2011-06` と `2011-06-04` は
   * 文字列。書き手にとっては同じ 1 つの欄なので、両方受ける。
   */
  it("reads the three levels of precision", () => {
    expect(HistoryDate.create(2011).toString()).toBe("2011");
    expect(HistoryDate.create("2011-06").toString()).toBe("2011-06");
    expect(HistoryDate.create("2011-06-04").toString()).toBe("2011-06-04");
  });

  it("keeps how precise the writer was", () => {
    expect(HistoryDate.create(2011).precision).toBe("year");
    expect(HistoryDate.create("2011-06").precision).toBe("month");
    expect(HistoryDate.create("2011-06-04").precision).toBe("day");
  });

  /*
   * 揃えるために覚えていない日を捏造させないための作りなので、**年だけと 1 月 1 日は
   * 別の値**でなければならない。
   */
  it("does not treat a year as the first day of that year", () => {
    expect(HistoryDate.create(2011).equals(HistoryDate.create("2011-01-01"))).toBe(false);
  });

  /* 桁を埋めない書き方は通さない (書かれた字を解釈し始めない)。 */
  it("rejects anything but the three canonical forms", () => {
    for (const raw of ["2011-6-4", "2011-06-04T00:00", "2011 年", "11-06-04", "", true, null]) {
      expect(() => HistoryDate.create(raw)).toThrow(InvalidHistoryDateError);
    }
  });

  it("rejects months and days outside the calendar", () => {
    for (const raw of ["2011-00", "2011-13", "2011-06-00", "2011-06-31", "2011-02-30"]) {
      expect(() => HistoryDate.create(raw)).toThrow(InvalidHistoryDateError);
    }
  });

  /** 閏年は Date に数えさせている。自前で数えると 2100 年で間違える。 */
  it("counts leap days", () => {
    expect(HistoryDate.create("2012-02-29").toString()).toBe("2012-02-29");
    expect(() => HistoryDate.create("2011-02-29")).toThrow(InvalidHistoryDateError);
    expect(() => HistoryDate.create("2100-02-29")).toThrow(InvalidHistoryDateError);
  });

  it("rejects a day without a month", () => {
    expect(() => HistoryDate.fromParts({ year: 2011, day: 4 })).toThrow(InvalidHistoryDateError);
  });

  it("orders earlier dates first", () => {
    const earlier = HistoryDate.create("2012-08-14");
    const later = HistoryDate.create("2012-08-18");

    expect(earlier.compare(later)).toBeLessThan(0);
    expect(later.compare(earlier)).toBeGreaterThan(0);
    expect(earlier.compare(HistoryDate.create("2012-08-14"))).toBe(0);
  });
});
