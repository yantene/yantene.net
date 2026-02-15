import type { IEntity } from "../entity.interface";
import type { IPersisted } from "../persisted.interface";
import type { IUnpersisted } from "../unpersisted.interface";
import type { ContentType } from "./content-type.vo";
import type { ETag } from "./etag.vo";
import type { ObjectKey } from "./object-key.vo";
import type { Temporal } from "@js-temporal/polyfill";

export class StoredObjectMetadata<P extends IPersisted | IUnpersisted>
  implements IEntity<StoredObjectMetadata<P>>
{
  private constructor(
    readonly id: P["id"],
    readonly objectKey: ObjectKey,
    readonly size: number,
    readonly contentType: ContentType,
    readonly etag: ETag,
    readonly downloadCount: number,
    readonly createdAt: P["createdAt"],
    readonly updatedAt: P["updatedAt"],
  ) {}

  static create(params: {
    objectKey: ObjectKey;
    size: number;
    contentType: ContentType;
    etag: ETag;
  }): StoredObjectMetadata<IUnpersisted> {
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
  }): StoredObjectMetadata<IPersisted> {
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

  equals(other: StoredObjectMetadata<P>): boolean {
    if (this.id == null || other.id == null) {
      return this === other;
    }
    return this.id === other.id;
  }

  toJSON(): {
    id: P["id"];
    objectKey: string;
    size: number;
    contentType: string;
    etag: string;
    downloadCount: number;
    createdAt: string | undefined;
    updatedAt: string | undefined;
  } {
    return {
      id: this.id,
      objectKey: this.objectKey.toJSON(),
      size: this.size,
      contentType: this.contentType.toJSON(),
      etag: this.etag.toJSON(),
      downloadCount: this.downloadCount,
      createdAt: this.createdAt?.toString(),
      updatedAt: this.updatedAt?.toString(),
    };
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
