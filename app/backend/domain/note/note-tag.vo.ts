import type { IValueObject } from "~/backend/domain/shared";

// タグはフロントマター由来のラベル (例: "日記", "GNU/Linux", "競技プログラミング")。
// 大文字小文字・記号 (スラッシュ等) はそのまま保つが、前後空白を正規化し、
// 空文字と過長を弾く。
const MAX_LENGTH = 50;

export class InvalidNoteTagError extends Error {
  readonly name = "InvalidNoteTagError";
}

export class NoteTag implements IValueObject<NoteTag> {
  private constructor(private readonly value: string) {}

  static create(raw: string): NoteTag {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidNoteTagError(
        `Note tag must be 1..${String(MAX_LENGTH)} characters long`,
      );
    }
    return new NoteTag(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: NoteTag): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
