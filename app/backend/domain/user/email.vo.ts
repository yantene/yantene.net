import type { IValueObject } from "~/backend/domain/shared";

// 厳密な RFC 5322 ではなくフォーマットチェック程度の簡易バリデーション。
// "@" を 1 つだけ含み、ドメインに少なくとも 1 つドットがあることを確認する。
// eslint-disable-next-line sonarjs/super-linear-regex -- 分離した文字クラスのみで backtracking しない
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LENGTH = 254;

export class InvalidEmailError extends Error {
  readonly name = "InvalidEmailError";
}

export class Email implements IValueObject<Email> {
  private constructor(private readonly value: string) {}

  static create(raw: string): Email {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidEmailError(
        `Email must be 1..${String(MAX_LENGTH)} characters long`,
      );
    }
    if (!emailPattern.test(trimmed)) {
      throw new InvalidEmailError("Email is not a valid format");
    }
    return new Email(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
