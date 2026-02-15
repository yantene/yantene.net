import { ContentType } from "../../domain/stored-object/content-type.vo";
import { ETag } from "../../domain/stored-object/etag.vo";
import { ObjectKey } from "../../domain/stored-object/object-key.vo";
import type {
  IStoredObjectStorage,
  StoredObjectContent,
  StoredObjectListItem,
} from "../../domain/stored-object/stored-object-storage.interface";

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

export class StoredObjectStorage implements IStoredObjectStorage {
  constructor(private readonly r2: R2Bucket) {}

  async get(objectKey: ObjectKey): Promise<StoredObjectContent | undefined> {
    const r2Object = await this.r2.get(objectKey.value);

    if (r2Object === null) {
      return undefined;
    }

    const contentType = this.getContentType(
      r2Object.httpMetadata?.contentType,
      objectKey.value,
    );

    return {
      body: r2Object.body,
      contentType: ContentType.create(contentType),
      size: r2Object.size,
      etag: ETag.create(r2Object.etag),
    };
  }

  async list(): Promise<readonly StoredObjectListItem[]> {
    const r2Objects = await this.r2.list();

    return r2Objects.objects.map((obj) => ({
      objectKey: ObjectKey.create(obj.key),
      size: obj.size,
      etag: ETag.create(obj.etag),
    }));
  }

  private getContentType(
    r2ContentType: string | undefined,
    objectKey: string,
  ): string {
    if (r2ContentType) {
      return r2ContentType;
    }

    // Infer content type from file extension
    const extension = objectKey.split(".").pop()?.toLowerCase();

    if (extension && extension in extensionToMimeType) {
      // eslint-disable-next-line security/detect-object-injection
      return extensionToMimeType[extension];
    }

    return defaultMimeType;
  }
}
