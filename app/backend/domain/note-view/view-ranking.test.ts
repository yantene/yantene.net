import { describe, expect, it } from "vitest";
import { decayScore, rankNoteScores, scoreAfterView } from "./view-ranking";
import type { NoteScore } from "./view-ranking";

const today = "2026-08-09";
const options = { halfLifeDays: 30, today };

function scored(
  noteId: string,
  score: number,
  scoredOn: string | null,
): NoteScore {
  return { noteId, score, scoredOn };
}

describe("decayScore", () => {
  it("触ったのが今日なら、そのままの値になる", () => {
    expect(decayScore(scored("a", 10, today), options)).toBeCloseTo(10, 5);
  });

  it("半減期を過ぎると半分になる", () => {
    expect(decayScore(scored("a", 10, "2026-07-10"), options)).toBeCloseTo(
      5,
      5,
    );
  });

  it("半減期 2 つぶんで 4 分の 1 になる", () => {
    expect(decayScore(scored("a", 10, "2026-06-10"), options)).toBeCloseTo(
      2.5,
      5,
    );
  });

  it("まだ読まれていなければ 0", () => {
    expect(decayScore(scored("a", 0, null), options)).toBe(0);
  });

  it("基準日より後の日付でも 1 を超えて増えない", () => {
    expect(decayScore(scored("a", 10, "2026-08-20"), options)).toBeCloseTo(
      10,
      5,
    );
  });
});

describe("scoreAfterView", () => {
  it("初めて読まれたら 1 になる", () => {
    expect(scoreAfterView(scored("a", 0, null), options)).toBeCloseTo(1, 5);
  });

  it("同じ日に続けて読まれた分はそのまま積み上がる", () => {
    const first = scoreAfterView(scored("a", 0, null), options);
    const second = scoreAfterView(scored("a", first, today), options);
    expect(second).toBeCloseTo(2, 5);
  });

  it("間が空くと、前の分だけが減ってから 1 が乗る", () => {
    // 半減期ぶん空けば、前の 10 は 5 になり、そこに今回の 1 が乗る。
    expect(scoreAfterView(scored("a", 10, "2026-07-10"), options)).toBeCloseTo(
      6,
      5,
    );
  });

  it("いま足した分は、その場では減衰しない", () => {
    // 足してから減衰させる実装だと 5.5 になってしまう。
    expect(
      scoreAfterView(scored("a", 10, "2026-07-10"), options),
    ).not.toBeCloseTo(5.5, 5);
  });
});

describe("rankNoteScores", () => {
  it("減衰後のスコアが高い順に並べる", () => {
    const ranked = rankNoteScores(
      [scored("a", 3, today), scored("b", 10, today), scored("c", 7, today)],
      options,
    );
    expect(ranked.map((r) => r.noteId)).toEqual(["b", "c", "a"]);
  });

  it("累計が多くても、古ければ新しい記事に抜かれる", () => {
    // 30 日前の 10 は 5 まで落ちるので、今日の 6 に負ける。
    const ranked = rankNoteScores(
      [scored("old", 10, "2026-07-10"), scored("new", 6, today)],
      options,
    );
    expect(ranked.map((r) => r.noteId)).toEqual(["new", "old"]);
  });

  it("古くても読まれ続けていれば上に来る", () => {
    const ranked = rankNoteScores(
      [scored("steady", 40, "2026-08-08"), scored("recent", 25, today)],
      options,
    );
    expect(ranked[0]?.noteId).toBe("steady");
  });

  it("読まれていないノートは現れない", () => {
    expect(rankNoteScores([scored("a", 0, null)], options)).toEqual([]);
    expect(rankNoteScores([], options)).toEqual([]);
  });

  it("同点は毎回同じ順で返す (順位が理由もなく入れ替わらない)", () => {
    const scores = [scored("b", 5, today), scored("a", 5, today)];
    expect(rankNoteScores(scores, options).map((r) => r.noteId)).toEqual([
      "a",
      "b",
    ]);
    expect(
      rankNoteScores(scores.toReversed(), options).map((r) => r.noteId),
    ).toEqual(["a", "b"]);
  });

  it("半減期が 0 以下なら受け付けない", () => {
    expect(() =>
      rankNoteScores([scored("a", 1, today)], { halfLifeDays: 0, today }),
    ).toThrow(RangeError);
  });

  it("読めない日付は受け付けない", () => {
    expect(() =>
      rankNoteScores([scored("a", 1, "not-a-date")], options),
    ).toThrow(RangeError);
  });
});
