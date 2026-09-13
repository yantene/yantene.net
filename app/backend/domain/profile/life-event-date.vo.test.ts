import { describe, expect, it } from "vitest";
import { InvalidLifeEventDateError, LifeEventDate } from "./life-event-date.vo";

describe("LifeEventDate", () => {
  it("keeps the day when the date is written to the day", () => {
    const date = LifeEventDate.create("1993-11-18");
    expect(date.precision).toBe("day");
    expect(date.toString()).toBe("1993-11-18");
    expect(date.sortKey).toBe("1993-11-18");
  });

  it("pads a month to the first day for sorting but shows the month", () => {
    const date = LifeEventDate.create("2012-04");
    expect(date.precision).toBe("month");
    expect(date.toString()).toBe("2012-04");
    expect(date.sortKey).toBe("2012-04-01");
  });

  /*
   * vfile-matter (YAML 1.2) は `2012` を数値で返す。型で粒度を見分けると YAML の機嫌に
   * 判定を預けることになるので、数値で来ても年として読めること。
   */
  it("reads a bare year, whether YAML hands it over as a number or a string", () => {
    for (const raw of [2012, "2012"]) {
      const date = LifeEventDate.create(raw);
      expect(date.precision).toBe("year");
      expect(date.toString()).toBe("2012");
      expect(date.sortKey).toBe("2012-01-01");
    }
  });

  it("rejects shapes that are not a date", () => {
    for (const raw of ["", "2012-4", "2012/04", "12-04-01", "2012-04-01T00:00:00Z", "きのう"]) {
      expect(() => LifeEventDate.create(raw)).toThrow(InvalidLifeEventDateError);
    }
  });

  it("rejects days that do not exist in the calendar", () => {
    expect(() => LifeEventDate.create("2012-13")).toThrow(InvalidLifeEventDateError);
    expect(() => LifeEventDate.create("2013-02-30")).toThrow(InvalidLifeEventDateError);
  });

  it("round-trips through the normalized key and the precision", () => {
    for (const raw of ["1993-11-18", "2012-04", "2012"]) {
      const date = LifeEventDate.create(raw);
      const restored = LifeEventDate.reconstruct(date.sortKey, date.precision);
      expect(restored.toString()).toBe(raw);
      expect(restored.equals(date)).toBe(true);
    }
  });

  it("rejects an unknown precision when restoring (broken row detection)", () => {
    expect(() => LifeEventDate.reconstruct("2012-01-01", "decade")).toThrow(
      InvalidLifeEventDateError,
    );
  });
});
