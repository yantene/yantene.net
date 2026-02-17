import { ContentType } from "../domain/stored-object/content-type.vo";
import { StoredObjectMetadata } from "../domain/stored-object/stored-object-metadata.entity";
import type { IStoredObjectMetadataCommandRepository } from "../domain/stored-object/stored-object-metadata-command-repository.interface";
import type { IStoredObjectMetadataQueryRepository } from "../domain/stored-object/stored-object-metadata-query-repository.interface";
import type { IStoredObjectStorage } from "../domain/stored-object/stored-object-storage.interface";

export type SyncResult = {
  added: number;
  deleted: number;
  updated: number;
};

export class SyncService {
  constructor(
    private readonly storage: IStoredObjectStorage,
    private readonly queryRepository: IStoredObjectMetadataQueryRepository,
    private readonly commandRepository: IStoredObjectMetadataCommandRepository,
  ) {}

  async execute(): Promise<SyncResult> {
    const [storageObjects, dbMetadata] = await Promise.all([
      this.storage.list(),
      this.queryRepository.findAll(),
    ]);

    const storageMap = new Map(
      storageObjects.map((obj) => [obj.objectKey.value, obj]),
    );
    const dbMap = new Map(
      dbMetadata.map((meta) => [meta.objectKey.value, meta]),
    );

    let added = 0;
    let deleted = 0;
    let updated = 0;

    // Add new objects
    for (const [key, storageObj] of storageMap) {
      if (!dbMap.has(key)) {
        const contentType = ContentType.inferFromObjectKey(
          storageObj.objectKey,
        );
        const newMetadata = StoredObjectMetadata.create({
          objectKey: storageObj.objectKey,
          size: storageObj.size,
          contentType,
          etag: storageObj.etag,
        });
        await this.commandRepository.upsert(newMetadata, false);
        added++;
      }
    }

    // Update changed objects
    for (const [key, storageObj] of storageMap) {
      const dbObj = dbMap.get(key);
      if (dbObj && !storageObj.etag.equals(dbObj.etag)) {
        const contentType = ContentType.inferFromObjectKey(
          storageObj.objectKey,
        );
        const updatedMetadata = StoredObjectMetadata.create({
          objectKey: storageObj.objectKey,
          size: storageObj.size,
          contentType,
          etag: storageObj.etag,
        });
        await this.commandRepository.upsert(updatedMetadata, true);
        updated++;
      }
    }

    // Delete removed objects
    for (const [key, dbObj] of dbMap) {
      if (!storageMap.has(key)) {
        await this.commandRepository.deleteByObjectKey(dbObj.objectKey);
        deleted++;
      }
    }

    return { added, deleted, updated };
  }
}
