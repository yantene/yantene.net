import type { IValueObject } from "~/backend/domain/shared";

// 名前はフロントマター由来の表示文字列。記号も括弧もそのまま保つが、前後の空白は
// 正規化し、空文字と過長を弾く。
const MAX_LENGTH = 100;

export class InvalidProfileNameError extends Error {
  readonly name = "InvalidProfileNameError";
}

export class ProfileName implements IValueObject<ProfileName> {
  private constructor(private readonly value: string) {}

  static create(raw: string): ProfileName {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidProfileNameError(
        `Profile name must be 1..${String(MAX_LENGTH)} characters long`,
      );
    }
    return new ProfileName(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ProfileName): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
