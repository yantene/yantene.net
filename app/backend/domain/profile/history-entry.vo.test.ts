import { describe, expect, it } from "vitest";
import { HistoryEntry, InvalidHistoryEntryError } from "./history-entry.vo";

describe("HistoryEntry", () => {
  it("accepts a chapter, a year and what happened", () => {
    const entry = HistoryEntry.create({
      chapter: "大学",
      year: 2012,
      text: "豊橋技術科学大学 工学部 情報・知能工学課程 入学",
    });
    expect(entry.chapter).toBe("大学");
    expect(entry.year).toBe(2012);
    expect(entry.text).toBe("豊橋技術科学大学 工学部 情報・知能工学課程 入学");
    expect(entry.url).toBeUndefined();
    expect(entry.note).toBeUndefined();
  });

  it("accepts an optional link and note", () => {
    const entry = HistoryEntry.create({
      chapter: "大学",
      year: 2012,
      text: "セキュリティ・キャンプ中央大会 2012",
      url: "https://www.youtube.com/watch?v=Ki1qb9q4z8E",
      note: "CTF チーム優勝",
    });
    expect(entry.url).toBe("https://www.youtube.com/watch?v=Ki1qb9q4z8E");
    expect(entry.note).toBe("CTF チーム優勝");
  });

  /*
   * 月は任意。卒業と入学は 3 月と 4 月と決まっているが、大会や合宿は覚えていないことが
   * ある。必須にすると、覚えていない月を埋めさせることになる。
   */
  it("accepts an optional month", () => {
    expect(HistoryEntry.create({ chapter: "大学", year: 2012, month: 4, text: "入学" }).month).toBe(
      4,
    );
    expect(
      HistoryEntry.create({ chapter: "大学", year: 2012, text: "入学" }).month,
    ).toBeUndefined();
  });

  it("rejects a month outside 1..12", () => {
    for (const month of [0, 13, -1, 4.5, Number.NaN]) {
      expect(() =>
        HistoryEntry.create({ chapter: "大学", year: 2012, month, text: "入学" }),
      ).toThrow(InvalidHistoryEntryError);
    }
  });

  it("trims the surrounding space", () => {
    const entry = HistoryEntry.create({ chapter: " 高校 ", year: 2012, text: " 卒業 " });
    expect(entry.chapter).toBe("高校");
    expect(entry.text).toBe("卒業");
  });

  it("rejects an empty chapter or text", () => {
    expect(() => HistoryEntry.create({ chapter: "  ", year: 2012, text: "卒業" })).toThrow(
      InvalidHistoryEntryError,
    );
    expect(() => HistoryEntry.create({ chapter: "高校", year: 2012, text: "  " })).toThrow(
      InvalidHistoryEntryError,
    );
  });

  /*
   * 年は西暦 4 桁の整数だけ通す。枠は打ち間違い (`11` や `20112`) をその場で止めるため
   * のもので、歴史的な正しさを主張するものではない。
   */
  it("rejects a year that is not a 4-digit integer", () => {
    for (const year of [11, 20112, 2012.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => HistoryEntry.create({ chapter: "高校", year, text: "卒業" })).toThrow(
        InvalidHistoryEntryError,
      );
    }
  });

  /*
   * 打ち間違いがそのまま href に乗る経路をドメインの外に作らない (`WorkUrl` と同じ線引き)。
   * `mailto:` も通さない。経歴の行から差し出す連絡先は無い。
   */
  it("rejects links that are not absolute http(s)", () => {
    for (const url of ["/works", "example.com", "javascript:alert(1)", "mailto:a@example.com"]) {
      expect(() => HistoryEntry.create({ chapter: "高校", year: 2012, text: "卒業", url })).toThrow(
        InvalidHistoryEntryError,
      );
    }
  });

  it("compares by value", () => {
    const params = { chapter: "高校", year: 2012, text: "卒業" };
    expect(HistoryEntry.create(params).equals(HistoryEntry.create(params))).toBe(true);
    expect(HistoryEntry.create(params).equals(HistoryEntry.create({ ...params, year: 2011 }))).toBe(
      false,
    );
    /* 章が違えば別の出来事。章は各件が持つ持ち物であって、外から付く札ではない。 */
    expect(
      HistoryEntry.create(params).equals(HistoryEntry.create({ ...params, chapter: "大学" })),
    ).toBe(false);
    /* 月を書き足したものは別の値。書いていない状態と同じにしない。 */
    expect(HistoryEntry.create(params).equals(HistoryEntry.create({ ...params, month: 3 }))).toBe(
      false,
    );
  });
});
