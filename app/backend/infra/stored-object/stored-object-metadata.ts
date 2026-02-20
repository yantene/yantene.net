import type { ContentType } from "../../domain/shared/content-type.vo";
import type { ETag } from "../../domain/shared/etag.vo";
import type { ObjectKey } from "../../domain/shared/object-key.vo";
import type { Temporal } from "@js-temporal/polyfill";

export class StoredObjectMetadata {
  private constructor(
    readonly id: string | undefined,
    readonly objectKey: ObjectKey,
    readonly size: number,
    readonly contentType: ContentType,
    readonly etag: ETag,
    readonly downloadCount: number,
    readonly createdAt: Temporal.Instant | undefined,
    readonly updatedAt: Temporal.Instant | undefined,
  ) {}

  static create(params: {
    objectKey: ObjectKey;
    size: number;
    contentType: ContentType;
    etag: ETag;
  }): StoredObjectMetadata {
    StoredObjectMetadata.validateSize(params.size);
    return new StoredObjectMetadata(
      undefined,
      params.objectKey,
      params.size,
      params.contentType,
      params.etag,
      0,
      undefined,
      undefined,
    );
  }

  static reconstruct(params: {
    id: string;
    objectKey: ObjectKey;
    size: number;
    contentType: ContentType;
    etag: ETag;
    downloadCount: number;
    createdAt: Temporal.Instant;
    updatedAt: Temporal.Instant;
  }): StoredObjectMetadata {
    StoredObjectMetadata.validateSize(params.size);
    StoredObjectMetadata.validateDownloadCount(params.downloadCount);
    return new StoredObjectMetadata(
      params.id,
      params.objectKey,
      params.size,
      params.contentType,
      params.etag,
      params.downloadCount,
      params.createdAt,
      params.updatedAt,
    );
  }

  private static validateSize(size: number): void {
    if (size < 0) {
      throw new Error(`Invalid size: ${String(size)}`);
    }
  }

  private static validateDownloadCount(downloadCount: number): void {
    if (downloadCount < 0) {
      throw new Error(`Invalid downloadCount: ${String(downloadCount)}`);
    }
  }
}
