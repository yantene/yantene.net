import type { IValueObject } from "~/backend/domain/shared";

// タイトルはフロントマター由来の表示文字列。大文字小文字・記号はそのまま保つが、
// 前後の空白は正規化し、空文字と過長を弾く。
const MAX_LENGTH = 200;

export class InvalidNoteTitleError extends Error {
  readonly name = "InvalidNoteTitleError";
}

export class NoteTitle implements IValueObject<NoteTitle> {
  private constructor(private readonly value: string) {}

  static create(raw: string): NoteTitle {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidNoteTitleError(
        `Note title must be 1..${String(MAX_LENGTH)} characters long`,
      );
    }
    return new NoteTitle(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: NoteTitle): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
