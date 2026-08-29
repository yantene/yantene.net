import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { clockOriginClassName, moonAgeDays, resolveClockOrigin } from "./clock-origin";

/** 平均朔望月 (日)。clock-origin.ts と同じ値。 */
const SYNODIC_MONTH_DAYS = 29.530588861;

/** この空の朔望月 (日)。celestim.css の --celestim-sidereal-month と同じ値。 */
const CYCLE_DAYS = 28;

const HOUR_MS = 3_600_000;

describe("moonAgeDays", () => {
  /*
   * 皆既日食は定義上その瞬間が朔なので、そこから 2 時間後の月齢は 2 時間ぶんになる。
   * 既知の日食を 3 つ置いて、補正項を削ったり定数を書き間違えたりしたときに落ちる
   * ようにする (平均朔だけで求めると最大 0.6 日ずれるので、ここが必ず落ちる)。
   *
   * 朔そのものではなく 2 時間後を見るのは、朔の直前だと月齢が 1 朔望月ぶんの側から
   * 数え上がってしまい、朔の長さの揺れ (29.3〜29.8 日) と区別が付かないため。
   */
  it.each([
    ["2017-08-21T18:26:00Z", "北米横断皆既日食"],
    ["2024-04-08T18:18:00Z", "北米皆既日食"],
    ["2026-08-12T17:46:00Z", "アイスランド・スペイン皆既日食"],
  ])("%s (%s) の 2 時間後の月齢が 2 時間ぶんになる", (at) => {
    const twoHoursLater = new Date(new Date(at).getTime() + 2 * HOUR_MS);

    expect(moonAgeDays(twoHoursLater) * 24).toBeCloseTo(2, 0);
  });

  it("日食でない日は朔から離れる", () => {
    // 上の日食からおよそ半月後。満月の頃なので、朔からは最も遠い。
    const age = moonAgeDays(new Date("2026-08-27T00:00:00Z"));

    expect(age).toBeGreaterThan(12);
    expect(age).toBeLessThan(17);
  });

  it("常に 0 以上、最長の朔望月未満を返す", () => {
    for (let day = 0; day < 60; day += 1) {
      const at = new Date(Date.UTC(2026, 0, 1) + day * 86_400_000);
      const age = moonAgeDays(at);
      expect(age).toBeGreaterThanOrEqual(0);
      // 実際の朔望月は平均より最大 0.3 日ほど長くなる。
      expect(age).toBeLessThan(30);
    }
  });
});

describe("resolveClockOrigin", () => {
  it("JST の時刻を刻みに丸めて返す", () => {
    // 12:07 JST。5 分刻みなので 12:05。
    const origin = resolveClockOrigin(new Date("2026-08-15T03:07:00Z"));
    expect(origin.minutesOfDay).toBe(12 * 60 + 5);
  });

  it("丸めが 24:00 に届いたら 0:00 に畳む", () => {
    // 23:58 JST。丸めると 24:00 になるので、そのままでは存在しないクラスを指す。
    const origin = resolveClockOrigin(new Date("2026-08-15T14:58:00Z"));
    expect(origin.minutesOfDay).toBe(0);
  });

  /*
   * 月に渡す月齢は 0 以上 28 未満の整数でなければならない。端数を入れると太陽だけが
   * 取り残され、満ち欠けと位置が噛み合わない月になる (clock-origin.css)。
   */
  it("月齢を 0 以上 28 未満の整数にする", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const origin = resolveClockOrigin(new Date(Date.UTC(2026, 7, 15, hour)));
      expect(Number.isSafeInteger(origin.moonAgeDay)).toBe(true);
      expect(origin.moonAgeDay).toBeGreaterThanOrEqual(0);
      expect(origin.moonAgeDay).toBeLessThan(CYCLE_DAYS);
    }
  });

  /*
   * 時刻ぶんのずらしは月のアニメーションにも掛かるので、渡す月齢はその分を引いた値に
   * なっている。引き忘れると、朝に開くほど月が老けて見える。ここでは CSS がやることを
   * 手で再現し、「ずらしを足し戻すと実際の月齢に戻る」ことを見る。
   *
   * 足し戻す量に 1 日を含めるのは、CSS 側が必ず翌日の同じ時刻まで進めるため
   * (理由は clock-origin.css にある)。許容が半日なのは、渡せるのが整数日だからで、
   * これがこの空で出せる月齢の限界でもある。
   */
  it("時刻ぶんのずらしを月齢から差し引いてある", () => {
    for (let hour = 0; hour < 24; hour += 3) {
      const now = new Date(Date.UTC(2026, 7, 15, hour));
      const origin = resolveClockOrigin(now);
      const shiftDays = (origin.minutesOfDay - 12 * 60) / 1440 + 1;
      const shown = (origin.moonAgeDay + shiftDays) % CYCLE_DAYS;
      const real = (moonAgeDays(now) / SYNODIC_MONTH_DAYS) * CYCLE_DAYS;

      expect(Math.abs(shown - real)).toBeLessThanOrEqual(0.5);
    }
  });
});

describe("clockOriginClassName", () => {
  it("時・分・月齢を 1 つずつ並べる", () => {
    const className = clockOriginClassName({
      minutesOfDay: 9 * 60 + 35,
      moonAgeDay: 3,
    });

    expect(className).toBe("clock-hour-9 clock-minute-35 moon-age-3");
  });

  it("真夜中も 0 時 0 分として出す", () => {
    const className = clockOriginClassName({
      minutesOfDay: 0,
      moonAgeDay: 0,
    });

    expect(className).toBe("clock-hour-0 clock-minute-0 moon-age-0");
  });
});

/*
 * ここが刻みの噛み合わせを見る唯一の場所。clock-origin.ts の刻みと clock-origin.css の
 * ルールは対で、片方だけ変えると存在しないクラス名が HTML に載る。CSS の当たらない
 * クラスは何のエラーも出さず、空が既定の南中のまま出るだけなので、型検査でも画面でも
 * 気づけない。
 *
 * CSS は import ではなく実ファイルから読む (vitest は CSS の import を空にする。
 * 理由と前例は theme-tokens.test.ts にある)。相対パスの解決に `new URL` を使わないのは、
 * happy-dom の URL が file: の基底を無視して http://localhost へ寄せてしまうため。
 */
describe("clock-origin.css との噛み合わせ", () => {
  const css = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "clock-origin.css"),
    "utf8",
  );
  const defined = new Set<string>();
  for (const [, className] of css.matchAll(/^\.([a-z0-9-]+)\s*\{/gm)) {
    defined.add(className);
  }

  /** 与えた時刻の並びで、CSS に無いクラス名を集める。 */
  function missingClassNames(instants: readonly Date[]): string[] {
    return instants
      .flatMap((at) => clockOriginClassName(resolveClockOrigin(at)).split(" "))
      .filter((className) => !defined.has(className));
  }

  it("1 日ぶんのどの時刻でも、載せるクラスが CSS にある", () => {
    const midnight = Date.UTC(2026, 7, 15);
    const everyStep = Array.from(
      { length: 1440 / 5 },
      (_, step) => new Date(midnight + step * 5 * 60_000),
    );

    expect(missingClassNames(everyStep)).toEqual([]);
  });

  it("朔望月ぶんのどの日でも、載せるクラスが CSS にある", () => {
    const start = Date.UTC(2026, 7, 1);
    const everyDay = Array.from({ length: 30 }, (_, day) => new Date(start + day * 86_400_000));

    expect(missingClassNames(everyDay)).toEqual([]);
  });
});
