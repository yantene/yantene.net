import type { IValueObject } from "~/backend/domain/shared";
import { Temporal } from "@js-temporal/polyfill";

/**
 * ライフイベントの日付の細かさ。覚えている範囲でしか書けないので 3 段階を許す。
 */
export type LifeEventPrecision = "day" | "month" | "year";

/*
 * 粒度の判定は**値の型ではなく文字列の形**で行う。
 *
 * フロントマターを読む vfile-matter (YAML 1.2) は `1993-11-18` と `2012-04` を文字列で、
 * `2012` を数値で返す。型で見分けると YAML の機嫌に判定を預けることになるので、
 * `String(value)` にしてから形で決める。
 */
const datePattern = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u;

/** D1 に入っている正規化キーの形。桁は必ず日まで埋まっている。 */
const dayPattern = /^\d{4}-\d{2}-\d{2}$/u;

export class InvalidLifeEventDateError extends Error {
  readonly name = "InvalidLifeEventDateError";
}

export class LifeEventDate implements IValueObject<LifeEventDate> {
  private constructor(
    /** 並べ替えのための正規化キー ("YYYY-MM-DD")。粒度の足りない桁は 01 で埋める。 */
    private readonly normalized: string,
    private readonly granularity: LifeEventPrecision,
  ) {}

  static create(raw: unknown): LifeEventDate {
    const text = String(raw).trim();
    if (!datePattern.test(text)) {
      throw new InvalidLifeEventDateError(
        `Life event date must be YYYY, YYYY-MM or YYYY-MM-DD, got ${text}`,
      );
    }
    const granularity = precisionOf(text);
    const normalized = padToDay(text, granularity);
    // 形が合っていても 2012-13 や 2013-02-30 は日付ではない。暦に無い日を弾く。
    if (!isRealDate(normalized)) {
      throw new InvalidLifeEventDateError(`Life event date is not a real date: ${text}`);
    }
    return new LifeEventDate(normalized, granularity);
  }

  /**
   * D1 に持っている正規化キーと粒度から戻す。
   *
   * 保存時に検証済みの値しか入らないので、ここでの再検証は破損データの検知を兼ねる
   * (読めない値を黙って既定に倒すと、どの粒度で書かれたのか分からなくなる)。
   */
  static reconstruct(normalized: string, granularity: string): LifeEventDate {
    if (!isLifeEventPrecision(granularity)) {
      throw new InvalidLifeEventDateError(`Unknown life event precision: ${granularity}`);
    }
    // 正規化キーのほうも見る。粒度だけを見ていると、`toString()` が壊れた値を切り出して
    // `<time dateTime>` と画面の両方に出る (日付として読めない字が残る)。
    if (!dayPattern.test(normalized) || !isRealDate(normalized)) {
      throw new InvalidLifeEventDateError(
        `Stored life event date is not a real date: ${normalized}`,
      );
    }
    return new LifeEventDate(normalized, granularity);
  }

  get precision(): LifeEventPrecision {
    return this.granularity;
  }

  /** 並べ替えに使うキー。辞書順 = 日付順。 */
  get sortKey(): string {
    return this.normalized;
  }

  /**
   * 書かれたままの値。`<time dateTime>` にはこれを入れる (HTML は `2012-04` も `2012`
   * も日付として許す)。埋めたほうを出すと、月までしか覚えていない出来事が 1 日に
   * 起きたことになってしまう。
   */
  toString(): string {
    if (this.granularity === "year") return this.normalized.slice(0, 4);
    if (this.granularity === "month") return this.normalized.slice(0, 7);
    return this.normalized;
  }

  equals(other: LifeEventDate): boolean {
    return this.normalized === other.normalized && this.granularity === other.granularity;
  }

  toJSON(): string {
    return this.toString();
  }
}

export function isLifeEventPrecision(value: string): value is LifeEventPrecision {
  return value === "day" || value === "month" || value === "year";
}

/** 暦に在る日か (`2012-13-01` や `2013-02-30` は形が合っていても日付ではない)。 */
function isRealDate(normalized: string): boolean {
  try {
    Temporal.PlainDate.from(normalized);
    return true;
  } catch {
    return false;
  }
}

function precisionOf(text: string): LifeEventPrecision {
  if (text.length === 4) return "year";
  if (text.length === 7) return "month";
  return "day";
}

function padToDay(text: string, granularity: LifeEventPrecision): string {
  if (granularity === "year") return `${text}-01-01`;
  if (granularity === "month") return `${text}-01`;
  return text;
}
