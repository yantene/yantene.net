import { Temporal } from "@js-temporal/polyfill";
import { eq, sql } from "drizzle-orm";
import { ContentType } from "../../../domain/stored-object/content-type.vo";
import { ETag } from "../../../domain/stored-object/etag.vo";
import { ObjectKey } from "../../../domain/stored-object/object-key.vo";
import { StoredObjectMetadata } from "../../../domain/stored-object/stored-object-metadata.entity";
import { fileDownloadCounts } from "../schema/file-download-counts.table";
import { objectStorageFileMetadata } from "../schema/object-storage-file-metadata.table";
import type { IPersisted } from "../../../domain/persisted.interface";
import type { IStoredObjectMetadataRepository } from "../../../domain/stored-object/stored-object-metadata-repository.interface";
import type { IUnpersisted } from "../../../domain/unpersisted.interface";
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

export class StoredObjectMetadataRepository implements IStoredObjectMetadataRepository {
  constructor(private readonly db: DrizzleD1Database) {}

  async findAll(): Promise<readonly StoredObjectMetadata<IPersisted>[]> {
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
  ): Promise<StoredObjectMetadata<IPersisted> | undefined> {
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

  async upsert(
    metadata: StoredObjectMetadata<IUnpersisted>,
    preserveDownloadCount = false,
  ): Promise<StoredObjectMetadata<IPersisted>> {
    const id = crypto.randomUUID();
    const now = Temporal.Now.instant();

    // Upsert metadata table
    const [metadataRow] = await this.db
      .insert(objectStorageFileMetadata)
      .values({
        id,
        objectKey: metadata.objectKey.value,
        size: metadata.size,
        contentType: metadata.contentType.value,
        etag: metadata.etag.value,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: objectStorageFileMetadata.objectKey,
        set: {
          size: metadata.size,
          contentType: metadata.contentType.value,
          etag: metadata.etag.value,
          updatedAt: now,
        },
      })
      .returning();

    if (!metadataRow) {
      throw new Error("Failed to upsert metadata");
    }

    // Upsert download count table
    if (preserveDownloadCount) {
      // Use COALESCE to preserve existing count
      await this.db
        .insert(fileDownloadCounts)
        .values({
          objectKey: metadata.objectKey.value,
          count: 0,
        })
        .onConflictDoNothing();
    } else {
      // Reset count to 0
      await this.db
        .insert(fileDownloadCounts)
        .values({
          objectKey: metadata.objectKey.value,
          count: 0,
        })
        .onConflictDoUpdate({
          target: fileDownloadCounts.objectKey,
          set: {
            count: 0,
          },
        });
    }

    // Fetch the complete record with download count
    const result = await this.findByObjectKey(metadata.objectKey);
    if (!result) {
      throw new Error("Failed to fetch upserted metadata");
    }

    return result;
  }

  async deleteByObjectKey(objectKey: ObjectKey): Promise<void> {
    // Delete from download counts first (foreign key constraint)
    await this.db
      .delete(fileDownloadCounts)
      .where(eq(fileDownloadCounts.objectKey, objectKey.value))
      .run();

    // Delete from metadata table
    await this.db
      .delete(objectStorageFileMetadata)
      .where(eq(objectStorageFileMetadata.objectKey, objectKey.value))
      .run();
  }

  async incrementDownloadCount(objectKey: ObjectKey): Promise<void> {
    await this.db
      .update(fileDownloadCounts)
      .set({
        count: sql`${fileDownloadCounts.count} + 1`,
      })
      .where(eq(fileDownloadCounts.objectKey, objectKey.value))
      .run();
  }

  private toEntity(
    row: StoredObjectWithCount,
  ): StoredObjectMetadata<IPersisted> {
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
