import { Temporal } from "@js-temporal/polyfill";
import { eq, sql } from "drizzle-orm";
import { fileDownloadCounts } from "../schema/file-download-counts.table";
import { objectStorageFileMetadata } from "../schema/object-storage-file-metadata.table";
import type { IPersisted } from "../../../domain/persisted.interface";
import type { ObjectKey } from "../../../domain/stored-object/object-key.vo";
import type { IStoredObjectMetadataCommandRepository } from "../../../domain/stored-object/stored-object-metadata-command-repository.interface";
import type { IStoredObjectMetadataQueryRepository } from "../../../domain/stored-object/stored-object-metadata-query-repository.interface";
import type { StoredObjectMetadata } from "../../../domain/stored-object/stored-object-metadata.entity";
import type { IUnpersisted } from "../../../domain/unpersisted.interface";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export class StoredObjectMetadataCommandRepository implements IStoredObjectMetadataCommandRepository {
  constructor(
    private readonly db: DrizzleD1Database,
    private readonly queryRepository: IStoredObjectMetadataQueryRepository,
  ) {}

  async upsert(
    metadata: StoredObjectMetadata<IUnpersisted>,
    preserveDownloadCount = false,
  ): Promise<StoredObjectMetadata<IPersisted>> {
    const id = crypto.randomUUID();
    const now = Temporal.Now.instant();

    // Upsert metadata table
    const rows = await this.db
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

    if (rows.length === 0) {
      throw new Error("Failed to upsert metadata");
    }

    // Upsert download count table
    // eslint-disable-next-line unicorn/prefer-ternary
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
    const result = await this.queryRepository.findByObjectKey(
      metadata.objectKey,
    );
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
}
