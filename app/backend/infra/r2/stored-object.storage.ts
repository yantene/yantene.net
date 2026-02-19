import { ContentType } from "../../domain/shared/content-type.vo";
import { ETag } from "../../domain/shared/etag.vo";
import { ObjectKey } from "../../domain/shared/object-key.vo";
import type {
  IStoredObjectStorage,
  StoredObjectContent,
  StoredObjectListItem,
} from "../../domain/shared/object-storage.interface";

export class StoredObjectStorage implements IStoredObjectStorage {
  constructor(private readonly r2: R2Bucket) {}

  async get(objectKey: ObjectKey): Promise<StoredObjectContent | undefined> {
    const r2Object = await this.r2.get(objectKey.value);

    if (r2Object === null) {
      return undefined;
    }

    // Use R2's httpMetadata.contentType if available, otherwise infer from object key
    const contentType = r2Object.httpMetadata?.contentType
      ? ContentType.create(r2Object.httpMetadata.contentType)
      : ContentType.inferFromObjectKey(objectKey);

    return {
      body: r2Object.body,
      contentType,
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
}
