import type { IValueObject } from "~/backend/domain/shared";

// 作品の名前。フロントマター由来の表示文字列で、スラグとは別に持つ。
// `openapi-sorbet-rails` のようにスラグと一致することもあるが、`arerd` のように
// 大文字や記号を含む名前を出したいことがあるので、同じものとして扱わない。
const MAX_LENGTH = 200;

export class InvalidWorkNameError extends Error {
  readonly name = "InvalidWorkNameError";
}

export class WorkName implements IValueObject<WorkName> {
  private constructor(private readonly value: string) {}

  static create(raw: string): WorkName {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidWorkNameError(`Work name must be 1..${String(MAX_LENGTH)} characters long`);
    }
    return new WorkName(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: WorkName): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
