import { ContentType } from "../../../domain/shared/content-type.vo";
import { ETag } from "../../../domain/shared/etag.vo";
import { ObjectKey } from "../../../domain/shared/object-key.vo";
import type {
  AssetContent,
  AssetListItem,
  IAssetStorage,
} from "../../../domain/note/asset-storage.interface";

const NOTES_PREFIX = "notes/";
const MD_EXTENSION = ".md";

export class AssetStorage implements IAssetStorage {
  constructor(private readonly r2: R2Bucket) {}

  async get(objectKey: ObjectKey): Promise<AssetContent | undefined> {
    const key = `${NOTES_PREFIX}${objectKey.value}`;
    const r2Object = await this.r2.get(key);

    if (r2Object === null) {
      return undefined;
    }

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

  async list(): Promise<readonly AssetListItem[]> {
    const r2Objects = await this.r2.list({ prefix: NOTES_PREFIX });

    return r2Objects.objects
      .filter((obj) => !obj.key.endsWith(MD_EXTENSION))
      .map((obj) => {
        const relativeKey = obj.key.slice(NOTES_PREFIX.length);
        const objectKey = ObjectKey.create(relativeKey);
        return {
          objectKey,
          size: obj.size,
          contentType: obj.httpMetadata?.contentType
            ? ContentType.create(obj.httpMetadata.contentType)
            : ContentType.inferFromObjectKey(objectKey),
          etag: ETag.create(obj.etag),
        };
      });
  }
}
