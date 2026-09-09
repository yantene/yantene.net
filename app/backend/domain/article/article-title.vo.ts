import type { IValueObject } from "~/backend/domain/shared";

// タイトルはフロントマター由来の表示文字列。大文字小文字・記号はそのまま保つが、
// 前後の空白は正規化し、空文字と過長を弾く。
const MAX_LENGTH = 200;

export class InvalidArticleTitleError extends Error {
  readonly name = "InvalidArticleTitleError";
}

export class ArticleTitle implements IValueObject<ArticleTitle> {
  private constructor(private readonly value: string) {}

  static create(raw: string): ArticleTitle {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidArticleTitleError(
        `Article title must be 1..${String(MAX_LENGTH)} characters long`,
      );
    }
    return new ArticleTitle(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ArticleTitle): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
