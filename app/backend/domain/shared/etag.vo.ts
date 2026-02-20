import type { IValueObject } from "./value-object.interface";

export class ETag implements IValueObject<ETag> {
  private constructor(readonly value: string) {}

  static create(value: string): ETag {
    if (!ETag.isValid(value)) {
      throw new Error(`Invalid etag: ${value}`);
    }
    return new ETag(value);
  }

  equals(other: ETag): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }

  private static isValid(value: string): boolean {
    return value.length > 0;
  }
}
