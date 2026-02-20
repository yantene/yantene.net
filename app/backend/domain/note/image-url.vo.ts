import { InvalidImageUrlError } from "./errors";
import type { IValueObject } from "../shared/value-object.interface";

export class ImageUrl implements IValueObject<ImageUrl> {
  private constructor(readonly value: string) {}

  static create(value: string): ImageUrl {
    if (!ImageUrl.isValid(value)) {
      throw new InvalidImageUrlError(value);
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
    if (value.startsWith("/") && !value.startsWith("//")) {
      return true;
    }
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
}
