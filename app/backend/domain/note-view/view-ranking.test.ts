import { describe, expect, it } from "vitest";
import { rankNoteViews } from "./view-ranking";
import type { DailyViewCount } from "./view-ranking";

const today = "2026-08-09";
const options = { halfLifeDays: 30, today };

function daily(
  noteId: string,
  viewedOn: string,
  viewCount: number,
): DailyViewCount {
  return { noteId, viewedOn, viewCount };
}

describe("rankNoteViews", () => {
  it("読まれた回数が多い順に並べる", () => {
    const ranked = rankNoteViews(
      [daily("a", today, 3), daily("b", today, 10), daily("c", today, 7)],
      options,
    );
    expect(ranked.map((r) => r.noteId)).toEqual(["b", "c", "a"]);
  });

  it("同じ回数なら、新しく読まれた方を上に置く", () => {
    const ranked = rankNoteViews(
      [daily("old", "2026-06-09", 10), daily("new", today, 10)],
      options,
    );
    expect(ranked.map((r) => r.noteId)).toEqual(["new", "old"]);
  });

  it("半減期を過ぎたアクセスは重みが半分になる", () => {
    // 30 日前の 10 回は、今日の 5 回と釣り合う。
    const ranked = rankNoteViews(
      [daily("decayed", "2026-07-10", 10), daily("fresh", today, 5)],
      options,
    );
    const scores = new Map(ranked.map((r) => [r.noteId, r.score]));
    expect(scores.get("decayed")).toBeCloseTo(5, 5);
    expect(scores.get("fresh")).toBeCloseTo(5, 5);
  });

  it("古くても読まれ続けていれば、最近の少数より上に来る", () => {
    // 累計を単に足すのでも、直近だけを見るのでもない。両方が効く。
    const ranked = rankNoteViews(
      [
        daily("steady", "2026-08-08", 20),
        daily("steady", "2026-07-01", 40),
        daily("steady", "2026-05-01", 80),
        daily("recent", today, 25),
      ],
      options,
    );
    expect(ranked[0]?.noteId).toBe("steady");
  });

  it("同じノートの複数日を足し合わせる", () => {
    const ranked = rankNoteViews(
      [daily("a", today, 2), daily("a", today, 3), daily("b", today, 4)],
      options,
    );
    expect(ranked.map((r) => r.noteId)).toEqual(["a", "b"]);
  });

  it("読まれていないノートは現れない", () => {
    expect(rankNoteViews([daily("a", today, 0)], options)).toEqual([]);
    expect(rankNoteViews([], options)).toEqual([]);
  });

  it("同点は毎回同じ順で返す (順位が理由もなく入れ替わらない)", () => {
    const counts = [daily("b", today, 5), daily("a", today, 5)];
    expect(rankNoteViews(counts, options).map((r) => r.noteId)).toEqual([
      "a",
      "b",
    ]);
    expect(
      rankNoteViews(counts.toReversed(), options).map((r) => r.noteId),
    ).toEqual(["a", "b"]);
  });

  it("基準日より後の日付でも重みは 1 を超えない", () => {
    const ranked = rankNoteViews(
      [daily("future", "2026-08-20", 10), daily("now", today, 10)],
      options,
    );
    const scores = new Map(ranked.map((r) => [r.noteId, r.score]));
    expect(scores.get("future")).toBeCloseTo(10, 5);
    expect(scores.get("now")).toBeCloseTo(10, 5);
  });

  it("半減期が 0 以下なら受け付けない", () => {
    expect(() =>
      rankNoteViews([daily("a", today, 1)], { halfLifeDays: 0, today }),
    ).toThrow(RangeError);
  });

  it("読めない日付は受け付けない", () => {
    expect(() => rankNoteViews([daily("a", "not-a-date", 1)], options)).toThrow(
      RangeError,
    );
  });
});
