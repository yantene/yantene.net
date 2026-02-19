import type { IValueObject } from "../value-object.interface";

export class ImageUrl implements IValueObject<ImageUrl> {
  private constructor(readonly value: string) {}

  static create(value: string): ImageUrl {
    if (!ImageUrl.isValid(value)) {
      throw new Error(`Invalid image url: ${value}`);
    }
    return new ImageUrl(value);
  }

  equals(other: ImageUrl): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }

  private static isValid(value: string): boolean {
    if (value.length === 0) {
      return false;
    }
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
}
