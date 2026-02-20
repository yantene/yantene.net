import { eq } from "drizzle-orm";
import { ContentType } from "../../../domain/shared/content-type.vo";
import { ETag } from "../../../domain/shared/etag.vo";
import { ObjectKey } from "../../../domain/shared/object-key.vo";
import { StoredObjectMetadata } from "../../stored-object/stored-object-metadata";
import { fileDownloadCounts } from "../schema/file-download-counts.table";
import { objectStorageFileMetadata } from "../schema/object-storage-file-metadata.table";
import type { IStoredObjectMetadataQueryRepository } from "../../stored-object/stored-object-metadata.query-repository.interface";
import type { Temporal } from "@js-temporal/polyfill";
import type { DrizzleD1Database } from "drizzle-orm/d1";

type StoredObjectWithCount = {
  id: string;
  objectKey: string;
  size: number;
  contentType: string;
  etag: string;
  createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
  downloadCount: number | null;
};

export class StoredObjectMetadataQueryRepository implements IStoredObjectMetadataQueryRepository {
  constructor(private readonly db: DrizzleD1Database) {}

  async findAll(): Promise<readonly StoredObjectMetadata[]> {
    const rows = await this.db
      .select({
        id: objectStorageFileMetadata.id,
        objectKey: objectStorageFileMetadata.objectKey,
        size: objectStorageFileMetadata.size,
        contentType: objectStorageFileMetadata.contentType,
        etag: objectStorageFileMetadata.etag,
        createdAt: objectStorageFileMetadata.createdAt,
        updatedAt: objectStorageFileMetadata.updatedAt,
        downloadCount: fileDownloadCounts.count,
      })
      .from(objectStorageFileMetadata)
      .leftJoin(
        fileDownloadCounts,
        eq(objectStorageFileMetadata.objectKey, fileDownloadCounts.objectKey),
      )
      .all();

    return rows.map((row) => this.toEntity(row as StoredObjectWithCount));
  }

  async findByObjectKey(
    objectKey: ObjectKey,
  ): Promise<StoredObjectMetadata | undefined> {
    const row = await this.db
      .select({
        id: objectStorageFileMetadata.id,
        objectKey: objectStorageFileMetadata.objectKey,
        size: objectStorageFileMetadata.size,
        contentType: objectStorageFileMetadata.contentType,
        etag: objectStorageFileMetadata.etag,
        createdAt: objectStorageFileMetadata.createdAt,
        updatedAt: objectStorageFileMetadata.updatedAt,
        downloadCount: fileDownloadCounts.count,
      })
      .from(objectStorageFileMetadata)
      .leftJoin(
        fileDownloadCounts,
        eq(objectStorageFileMetadata.objectKey, fileDownloadCounts.objectKey),
      )
      .where(eq(objectStorageFileMetadata.objectKey, objectKey.value))
      .get();

    if (!row) {
      return undefined;
    }

    return this.toEntity(row as StoredObjectWithCount);
  }

  private toEntity(row: StoredObjectWithCount): StoredObjectMetadata {
    return StoredObjectMetadata.reconstruct({
      id: row.id,
      objectKey: ObjectKey.create(row.objectKey),
      size: row.size,
      contentType: ContentType.create(row.contentType),
      etag: ETag.create(row.etag),
      downloadCount: row.downloadCount ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
