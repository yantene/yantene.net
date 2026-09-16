import { describe, expect, it } from "vitest";
import { HistoryDate } from "./history-date.vo";
import { HistoryEntry, InvalidHistoryEntryError } from "./history-entry.vo";

const on = (raw: string | number): HistoryDate => HistoryDate.create(raw);

describe("HistoryEntry", () => {
  it("accepts a chapter, a date and what happened", () => {
    const entry = HistoryEntry.create({
      chapter: "大学",
      date: on("2012-04"),
      text: "豊橋技術科学大学 工学部 情報・知能工学課程 入学",
    });
    expect(entry.chapter).toBe("大学");
    expect(entry.date.toString()).toBe("2012-04");
    expect(entry.until).toBeUndefined();
    expect(entry.text).toBe("豊橋技術科学大学 工学部 情報・知能工学課程 入学");
    expect(entry.url).toBeUndefined();
    expect(entry.note).toBeUndefined();
  });

  it("accepts an optional link and note", () => {
    const entry = HistoryEntry.create({
      chapter: "大学",
      date: on("2012-08-14"),
      text: "セキュリティ・キャンプ中央大会 2012",
      url: "https://www.youtube.com/watch?v=Ki1qb9q4z8E",
      note: "CTF チーム優勝",
    });
    expect(entry.url).toBe("https://www.youtube.com/watch?v=Ki1qb9q4z8E");
    expect(entry.note).toBe("CTF チーム優勝");
  });

  it("accepts an end for events that span days", () => {
    const entry = HistoryEntry.create({
      chapter: "高校",
      date: on("2012-02-20"),
      until: on("2012-02-24"),
      text: "Ruby 合宿 2012 春",
    });
    expect(entry.until?.toString()).toBe("2012-02-24");
  });

  /*
   * 精度が混ざると、どこまで分かっているのかが読み手にも機械にも取れなくなる
   * (`2012-08-14 〜 2012-08` は何日までなのか言えない)。
   */
  it("rejects an end at a different precision", () => {
    expect(() =>
      HistoryEntry.create({
        chapter: "高校",
        date: on("2012-02-20"),
        until: on("2012-02"),
        text: "合宿",
      }),
    ).toThrow(InvalidHistoryEntryError);
  });

  /** 同じ日を終わりに書くのは点の出来事なので、`until` を消すのが正しい。 */
  it("rejects an end that does not come after the start", () => {
    for (const until of ["2012-02-20", "2012-02-19"]) {
      expect(() =>
        HistoryEntry.create({
          chapter: "高校",
          date: on("2012-02-20"),
          until: on(until),
          text: "合宿",
        }),
      ).toThrow(InvalidHistoryEntryError);
    }
  });

  it("trims the surrounding space", () => {
    const entry = HistoryEntry.create({ chapter: " 高校 ", date: on(2012), text: " 卒業 " });
    expect(entry.chapter).toBe("高校");
    expect(entry.text).toBe("卒業");
  });

  it("rejects an empty chapter or text", () => {
    expect(() => HistoryEntry.create({ chapter: "  ", date: on(2012), text: "卒業" })).toThrow(
      InvalidHistoryEntryError,
    );
    expect(() => HistoryEntry.create({ chapter: "高校", date: on(2012), text: "  " })).toThrow(
      InvalidHistoryEntryError,
    );
  });

  /*
   * 打ち間違いがそのまま href に乗る経路をドメインの外に作らない (`WorkUrl` と同じ線引き)。
   * `mailto:` も通さない。経歴の行から差し出す連絡先は無い。
   */
  it("rejects links that are not absolute http(s)", () => {
    for (const url of ["/works", "example.com", "javascript:alert(1)", "mailto:a@example.com"]) {
      expect(() =>
        HistoryEntry.create({ chapter: "高校", date: on(2012), text: "卒業", url }),
      ).toThrow(InvalidHistoryEntryError);
    }
  });

  it("compares by value", () => {
    const params = { chapter: "高校", date: on(2012), text: "卒業" };
    expect(HistoryEntry.create(params).equals(HistoryEntry.create(params))).toBe(true);
    expect(
      HistoryEntry.create(params).equals(HistoryEntry.create({ ...params, date: on(2011) })),
    ).toBe(false);
    /* 章が違えば別の出来事。章は各件が持つ持ち物であって、外から付く札ではない。 */
    expect(
      HistoryEntry.create(params).equals(HistoryEntry.create({ ...params, chapter: "大学" })),
    ).toBe(false);
    /* 終わりを書き足したものは別の値。点の出来事と同じにしない。 */
    expect(
      HistoryEntry.create(params).equals(HistoryEntry.create({ ...params, until: on(2013) })),
    ).toBe(false);
  });
});
