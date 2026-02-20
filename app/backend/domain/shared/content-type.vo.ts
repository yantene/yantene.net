import type { ObjectKey } from "./object-key.vo";
import type { IValueObject } from "./value-object.interface";

const extensionToMimeType: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain",
  md: "text/markdown",
  html: "text/html",
  json: "application/json",
};

const defaultMimeType = "application/octet-stream";

export class ContentType implements IValueObject<ContentType> {
  private constructor(readonly value: string) {}

  static create(value: string): ContentType {
    if (!ContentType.isValid(value)) {
      throw new Error(`Invalid content type: ${value}`);
    }
    return new ContentType(value);
  }

  static inferFromObjectKey(objectKey: ObjectKey): ContentType {
    const extension = objectKey.value.split(".").pop()?.toLowerCase();

    if (extension && extension in extensionToMimeType) {
      // eslint-disable-next-line security/detect-object-injection
      return ContentType.create(extensionToMimeType[extension]);
    }

    return ContentType.create(defaultMimeType);
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
