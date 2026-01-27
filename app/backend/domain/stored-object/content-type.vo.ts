import type { IValueObject } from "../value-object.interface";

export class ContentType implements IValueObject<ContentType> {
  private constructor(readonly value: string) {}

  static create(value: string): ContentType {
    if (!ContentType.isValid(value)) {
      throw new Error(`Invalid content type: ${value}`);
    }
    return new ContentType(value);
  }

  equals(other: ContentType): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }

  isImage(): boolean {
    return this.value.startsWith("image/");
  }

  isMarkdown(): boolean {
    return this.value === "text/markdown";
  }

  private static isValid(value: string): boolean {
    return value.length > 0;
  }
}
