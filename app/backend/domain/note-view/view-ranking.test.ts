import { describe, expect, it } from "vitest";
import {
  logScoreAfterView,
  VIEW_SCORE_EPOCH,
  VIEW_SCORE_HALF_LIFE_DAYS,
  viewWeightLog,
} from "./view-ranking";

/** 対数で持っている値を、比べやすいように素の重みへ戻す。 */
const plain = (logScore: number): number => Math.exp(logScore);

/** まだ読まれていない記事のスコア (下駄のぶんだけ乗っている)。 */
const UNREAD = 0;

/** 基準日から days 日後の ISO 日付。 */
function dayAfterEpoch(days: number): string {
  const ms = Date.parse(`${VIEW_SCORE_EPOCH}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** その日に count 回読まれたぶんを積む。 */
function viewedTimes(initial: number, count: number, viewedOn: string): number {
  let score = initial;
  for (let i = 0; i < count; i++) score = logScoreAfterView(score, viewedOn);
  return score;
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
  it("未読は 0 から始まり、下駄は 1 回ぶんに当たる", () => {
    // 対数の 0 は素の 1。まだ読まれていなくても -∞ にはならない。
    expect(plain(UNREAD)).toBeCloseTo(1, 9);
  });

  it("初めて読まれたら、下駄にその日の重みが乗る", () => {
    const day = dayAfterEpoch(90);
    const score = logScoreAfterView(UNREAD, day);
    expect(plain(score)).toBeCloseTo(1 + plain(viewWeightLog(day)), 6);
  });

  it("同じ日に 2 回読まれたら重みが 2 つ分積まれる", () => {
    const day = dayAfterEpoch(90);
    const twice = viewedTimes(UNREAD, 2, day);
    expect(plain(twice)).toBeCloseTo(1 + plain(viewWeightLog(day)) * 2, 6);
  });

  it("後から読まれた 1 回は、半減期ぶん前の 1 回の 2 倍の重みを持つ", () => {
    const older = plain(logScoreAfterView(UNREAD, dayAfterEpoch(0))) - 1;
    const newer =
      plain(
        logScoreAfterView(UNREAD, dayAfterEpoch(VIEW_SCORE_HALF_LIFE_DAYS)),
      ) - 1;
    expect(newer / older).toBeCloseTo(2, 6);
  });

  it("古い記事が読まれ続けても、新しい少数に抜かれることがある", () => {
    // 基準日に 10 回 (重み 1 × 10) と、半減期 2 つ後に 3 回 (重み 4 × 3)。
    const old = viewedTimes(UNREAD, 10, dayAfterEpoch(0));
    const fresh = viewedTimes(
      UNREAD,
      3,
      dayAfterEpoch(VIEW_SCORE_HALF_LIFE_DAYS * 2),
    );
    expect(fresh).toBeGreaterThan(old);
    // 下駄のぶん 1 が乗る。
    expect(plain(old)).toBeCloseTo(11, 6);
    expect(plain(fresh)).toBeCloseTo(13, 6);
  });

  it("読まれ続ければ、間が空いた記事を追い越す", () => {
    let steady = UNREAD;
    for (let day = 0; day <= 120; day += 10) {
      steady = logScoreAfterView(steady, dayAfterEpoch(day));
    }
    const stale = logScoreAfterView(UNREAD, dayAfterEpoch(0));
    expect(steady).toBeGreaterThan(stale);
  });

  it("下駄は全記事に等しく乗るので、順位を歪めない", () => {
    const day = dayAfterEpoch(60);
    const many = viewedTimes(UNREAD, 5, day);
    const few = viewedTimes(UNREAD, 2, day);
    const unread = UNREAD;
    expect(many).toBeGreaterThan(few);
    expect(few).toBeGreaterThan(unread);
  });

  it("何年ぶんでも溢れない (対数のまま持つ意味)", () => {
    // 100 年ぶん先の日付でも、対数の値は有限のまま。
    const score = logScoreAfterView(UNREAD, dayAfterEpoch(36_500));
    expect(Number.isFinite(score)).toBe(true);
    // 素に戻すと倍精度では表せない大きさになる (だから対数で持っている)。
    expect(plain(score)).toBe(Infinity);
  });

  it("読めない日付は受け付けない", () => {
    expect(() => logScoreAfterView(UNREAD, "not-a-date")).toThrow(RangeError);
  });
});
