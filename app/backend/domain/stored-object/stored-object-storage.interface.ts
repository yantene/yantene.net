import type { ContentType } from "./content-type.vo";
import type { ObjectKey } from "./object-key.vo";
import type { ETag } from "../shared/etag.vo";

export type StoredObjectContent = {
  body: ReadableStream;
  contentType: ContentType;
  size: number;
  etag: ETag;
};

export type StoredObjectListItem = {
  objectKey: ObjectKey;
  size: number;
  etag: ETag;
};

export interface IStoredObjectStorage {
  get(objectKey: ObjectKey): Promise<StoredObjectContent | undefined>;
  list(): Promise<readonly StoredObjectListItem[]>;
}
