import type { IValueObject } from "~/backend/domain/shared";

// スラグは URL パスセグメントに乗る識別子。小文字英数字とハイフンのみ許可する。
// ハイフンの位置制約 (先頭・末尾・連続の禁止) はネストした量指定子の正規表現で
// まとめて表現すると ReDoS 検知に触れるため、単純な文字クラス検査 + 個別チェックに分ける。
const slugCharsPattern = /^[a-z0-9-]+$/;
const MAX_LENGTH = 200;

export class InvalidNoteSlugError extends Error {
  readonly name = "InvalidNoteSlugError";
}

export class NoteSlug implements IValueObject<NoteSlug> {
  private constructor(private readonly value: string) {}

  static create(raw: string): NoteSlug {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidNoteSlugError(
        `Note slug must be 1..${String(MAX_LENGTH)} characters long`,
      );
    }
    if (
      !slugCharsPattern.test(trimmed) ||
      trimmed.startsWith("-") ||
      trimmed.endsWith("-") ||
      trimmed.includes("--")
    ) {
      throw new InvalidNoteSlugError(
        "Note slug must be lowercase alphanumerics separated by single hyphens",
      );
    }
    return new NoteSlug(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: NoteSlug): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
