import type { IValueObject } from "~/backend/domain/shared";

/*
 * 経歴の出来事が起きた日。**精度が 3 段ある** — 年だけ、月まで、日まで。
 *
 * 書き手が覚えている細かさはまちまちで、卒業は 3 月としか覚えていなくても、大会は
 * 6 月 4 日まで分かる。**揃えるために覚えていない日を捏造させない**ために、精度そのものを
 * 値に持たせる (`2011` と `2011-01-01` は別の値)。
 *
 * 書式は `2011` / `2011-06` / `2011-06-04` の 3 通りだけ。**桁を埋めること** (`2011-6-4`
 * は通さない)。書かれた字を解釈し始めると、`2011 年ごろ` のような字も «たぶん 2011» として
 * 通ってしまう。
 *
 * ⚠️ **YAML は `2011` を数、`2011-06` と `2011-06-04` を文字列として渡してくる**
 * (vfile-matter は timestamp 型を当てないので Date にはならない。実測済み)。
 * 同じ欄に 3 通りが来るので、数も受ける。
 */
const MIN_YEAR = 1000;
const MAX_YEAR = 9999;
const PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/u;

export class InvalidHistoryDateError extends Error {
  readonly name = "InvalidHistoryDateError";
}

/** 精度。細かいほうが大きい数になっていて、`until` との突き合わせに使う。 */
export type HistoryDatePrecision = "year" | "month" | "day";

interface HistoryDateFields {
  readonly year: number;
  readonly month: number | undefined;
  readonly day: number | undefined;
}

export class HistoryDate implements IValueObject<HistoryDate> {
  private constructor(private readonly fields: HistoryDateFields) {}

  /** フロントマターから。数 (`2011`) と文字列 (`2011-06-04`) のどちらも受ける。 */
  static create(raw: unknown): HistoryDate {
    if (typeof raw === "number") return HistoryDate.fromParts({ year: requireYear(raw) });
    if (typeof raw !== "string") {
      throw new InvalidHistoryDateError(
        `History date must be 2011, 2011-06 or 2011-06-04, got ${JSON.stringify(raw)}`,
      );
    }
    const matched = PATTERN.exec(raw.trim());
    if (matched === null) {
      throw new InvalidHistoryDateError(
        `History date must be 2011, 2011-06 or 2011-06-04, got ${JSON.stringify(raw)}`,
      );
    }
    const [, year, month, day] = matched;
    return HistoryDate.fromParts({
      year: requireYear(Number(year)),
      ...(month === undefined ? {} : { month: Number(month) }),
      ...(day === undefined ? {} : { day: Number(day) }),
    });
  }

  /** D1 の行から。保存時に検証済みなので、ここでの再検証は破損の検知を兼ねる。 */
  static fromParts(params: { year: number; month?: number; day?: number }): HistoryDate {
    const year = requireYear(params.year);
    const month = params.month;
    const day = params.day;
    if (day !== undefined && month === undefined) {
      throw new InvalidHistoryDateError("History date cannot carry a day without a month");
    }
    if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
      throw new InvalidHistoryDateError(
        `History month must be 1..12, got ${JSON.stringify(month)}`,
      );
    }
    if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > daysIn(year, month))) {
      throw new InvalidHistoryDateError(
        `History day must be 1..${String(daysIn(year, month))} for ${String(year)}-${String(month)}, got ${JSON.stringify(day)}`,
      );
    }
    return new HistoryDate({ year, month, day });
  }

  get year(): number {
    return this.fields.year;
  }

  get month(): number | undefined {
    return this.fields.month;
  }

  get day(): number | undefined {
    return this.fields.day;
  }

  get precision(): HistoryDatePrecision {
    if (this.fields.day !== undefined) return "day";
    if (this.fields.month !== undefined) return "month";
    return "year";
  }

  /** 書式は書き手が書いたものと同じ (`2011` / `2011-06` / `2011-06-04`)。 */
  toString(): string {
    const parts = [pad(this.fields.year, 4), pad(this.fields.month, 2), pad(this.fields.day, 2)];
    return parts.filter((part) => part !== undefined).join("-");
  }

  /** 早いほうが小さい。精度が違う値は書いていない位を 0 として比べる。 */
  compare(other: HistoryDate): number {
    const ordered = [
      this.fields.year - other.fields.year,
      (this.fields.month ?? 0) - (other.fields.month ?? 0),
      (this.fields.day ?? 0) - (other.fields.day ?? 0),
    ];
    return ordered.find((diff) => diff !== 0) ?? 0;
  }

  equals(other: HistoryDate): boolean {
    return this.toString() === other.toString();
  }

  toJSON(): string {
    return this.toString();
  }
}

function requireYear(raw: number): number {
  if (!Number.isInteger(raw) || raw < MIN_YEAR || raw > MAX_YEAR) {
    throw new InvalidHistoryDateError(
      `History year must be an integer in ${String(MIN_YEAR)}..${String(MAX_YEAR)}, got ${JSON.stringify(raw)}`,
    );
  }
  return raw;
}

/** その月の日数。閏年は Date に数えさせる (自前で数えると 2100 年で間違える)。 */
function daysIn(year: number, month: number | undefined): number {
  if (month === undefined) return 31;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number | undefined, width: number): string | undefined {
  return value === undefined ? undefined : String(value).padStart(width, "0");
}
