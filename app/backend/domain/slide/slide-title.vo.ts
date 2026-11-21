import type { IValueObject } from "~/backend/domain/shared";

// スライドの題。フロントマター由来の表示文字列で、表紙と一覧と `<title>` に出る。
// スラグとは別に持つ (題は日本語で書くが、スラグは URL に乗る英数字)。
const MAX_LENGTH = 200;

export class InvalidSlideTitleError extends Error {
  readonly name = "InvalidSlideTitleError";
}

export class SlideTitle implements IValueObject<SlideTitle> {
  private constructor(private readonly value: string) {}

  static create(raw: string): SlideTitle {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidSlideTitleError(
        `Slide title must be 1..${String(MAX_LENGTH)} characters long`,
      );
    }
    return new SlideTitle(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: SlideTitle): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
