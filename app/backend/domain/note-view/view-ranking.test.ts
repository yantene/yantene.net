import { describe, expect, it } from "vitest";
import {
  logScoreAfterView,
  VIEW_SCORE_EPOCH,
  VIEW_SCORE_HALF_LIFE_DAYS,
  viewWeightLog,
} from "./view-ranking";

/** 対数で持っている値を、比べやすいように素の重みへ戻す。 */
const plain = (logScore: number): number => Math.exp(logScore);

/** 基準日から days 日後の ISO 日付。 */
function dayAfterEpoch(days: number): string {
  const ms = Date.parse(`${VIEW_SCORE_EPOCH}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

describe("viewWeightLog", () => {
  it("基準日のアクセスの重みは 1", () => {
    expect(plain(viewWeightLog(VIEW_SCORE_EPOCH))).toBeCloseTo(1, 9);
  });

  it("半減期ぶん経つと重みが 2 倍になる", () => {
    expect(
      plain(viewWeightLog(dayAfterEpoch(VIEW_SCORE_HALF_LIFE_DAYS))),
    ).toBeCloseTo(2, 9);
    expect(
      plain(viewWeightLog(dayAfterEpoch(VIEW_SCORE_HALF_LIFE_DAYS * 2))),
    ).toBeCloseTo(4, 9);
  });

  it("基準日より前は 1 より軽くなる", () => {
    expect(
      plain(viewWeightLog(dayAfterEpoch(-VIEW_SCORE_HALF_LIFE_DAYS))),
    ).toBeCloseTo(0.5, 9);
  });
});

describe("logScoreAfterView", () => {
  it("初めて読まれたら、その日の重みそのものになる", () => {
    const day = dayAfterEpoch(90);
    expect(logScoreAfterView(null, day)).toBeCloseTo(viewWeightLog(day), 9);
  });

  it("同じ日に 2 回読まれたら重みが 2 つ分になる", () => {
    const day = dayAfterEpoch(90);
    const once = logScoreAfterView(null, day);
    const twice = logScoreAfterView(once, day);
    expect(plain(twice)).toBeCloseTo(plain(once) * 2, 6);
  });

  it("後から読まれた 1 回は、半減期ぶん前の 1 回の 2 倍の重みを持つ", () => {
    const older = logScoreAfterView(null, dayAfterEpoch(0));
    const newer = logScoreAfterView(
      null,
      dayAfterEpoch(VIEW_SCORE_HALF_LIFE_DAYS),
    );
    expect(plain(newer) / plain(older)).toBeCloseTo(2, 6);
  });

  it("古い記事が読まれ続けても、新しい少数に抜かれることがある", () => {
    // 基準日に 10 回読まれた記事 (重み 1 × 10) と、半減期 2 つ後に 3 回読まれた記事 (重み 4 × 3)。
    let old = null as number | null;
    for (let i = 0; i < 10; i++) old = logScoreAfterView(old, dayAfterEpoch(0));

    let fresh = null as number | null;
    for (let i = 0; i < 3; i++) {
      fresh = logScoreAfterView(
        fresh,
        dayAfterEpoch(VIEW_SCORE_HALF_LIFE_DAYS * 2),
      );
    }

    // 対数のまま比べても順序は保たれる (10 < 12 なので新しい方が上)。
    expect(fresh).toBeGreaterThan(old as number);
    expect(plain(old as number)).toBeCloseTo(10, 6);
    expect(plain(fresh as number)).toBeCloseTo(12, 6);
  });

  it("読まれ続ければ、間が空いた記事を追い越す", () => {
    let steady = null as number | null;
    for (let day = 0; day <= 120; day += 10) {
      steady = logScoreAfterView(steady, dayAfterEpoch(day));
    }
    const stale = logScoreAfterView(null, dayAfterEpoch(0));
    expect(steady).toBeGreaterThan(stale);
  });

  it("何年ぶんでも溢れない (対数のまま持つ意味)", () => {
    // 100 年ぶん先の日付でも、対数の値は有限のまま。
    const far = dayAfterEpoch(36_500);
    const score = logScoreAfterView(null, far);
    expect(Number.isFinite(score)).toBe(true);
    // 素に戻すと倍精度では表せない大きさになる (だから対数で持っている)。
    expect(plain(score)).toBe(Infinity);
  });

  it("読めない日付は受け付けない", () => {
    expect(() => logScoreAfterView(null, "not-a-date")).toThrow(RangeError);
  });
});
