import type { IValueObject } from "~/backend/domain/shared";

/*
 * 作品の概要。`/about` と `/works` が並べる 1 行。
 *
 * **記事の要約と違って手で書く。** 記事は MDAST の先頭 160 文字を切り出すが、あちらは
 * 本文の書き出しがそのまま要約になる形式で、作品の説明文はそうならない (「2019 年に
 * 作り始めた。」から始まる本文の先頭を並べても、何を作ったのかが分からない)。
 *
 * 改行は入れない。並ぶのは箇条の 1 行なので、書き手が折り返しを決める場所ではない。
 */
const MAX_LENGTH = 200;

export class InvalidWorkSummaryError extends Error {
  readonly name = "InvalidWorkSummaryError";
}

export class WorkSummary implements IValueObject<WorkSummary> {
  private constructor(private readonly value: string) {}

  static create(raw: string): WorkSummary {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidWorkSummaryError(
        `Work summary must be 1..${String(MAX_LENGTH)} characters long`,
      );
    }
    if (trimmed.includes("\n")) {
      throw new InvalidWorkSummaryError("Work summary must be a single line");
    }
    return new WorkSummary(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: WorkSummary): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
