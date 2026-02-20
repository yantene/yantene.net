import type { ContentType } from "../shared/content-type.vo";
import type { ETag } from "../shared/etag.vo";
import type { ObjectKey } from "../shared/object-key.vo";

export type AssetContent = {
  readonly body: ReadableStream;
  readonly contentType: ContentType;
  readonly size: number;
  readonly etag: ETag;
};

export type AssetListItem = {
  readonly objectKey: ObjectKey;
  readonly size: number;
  readonly contentType: ContentType;
  readonly etag: ETag;
};

export interface IAssetStorage {
  get(objectKey: ObjectKey): Promise<AssetContent | undefined>;
  list(): Promise<readonly AssetListItem[]>;
}
