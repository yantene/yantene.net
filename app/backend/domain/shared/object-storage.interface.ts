import type { ContentType } from "./content-type.vo";
import type { ETag } from "./etag.vo";
import type { ObjectKey } from "./object-key.vo";

export type StoredObjectContent = {
  readonly body: ReadableStream;
  readonly contentType: ContentType;
  readonly size: number;
  readonly etag: ETag;
};

export type StoredObjectListItem = {
  readonly objectKey: ObjectKey;
  readonly size: number;
  readonly etag: ETag;
};

export interface IStoredObjectStorage {
  get(objectKey: ObjectKey): Promise<StoredObjectContent | undefined>;
  list(): Promise<readonly StoredObjectListItem[]>;
}
