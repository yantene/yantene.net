import { ContentType } from "../domain/shared/content-type.vo";
import { StoredObjectMetadata } from "../infra/stored-object/stored-object-metadata";
import type { SyncResult } from "./sync-result";
import type { IStoredObjectStorage } from "../domain/shared/object-storage.interface";
import type { IStoredObjectMetadataCommandRepository } from "../infra/stored-object/stored-object-metadata.command-repository.interface";
import type { IStoredObjectMetadataQueryRepository } from "../infra/stored-object/stored-object-metadata.query-repository.interface";

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

    const storageEntries = [...storageMap.values()];
    const toAdd = storageEntries.filter(
      (obj) => !dbMap.has(obj.objectKey.value),
    );
    const toUpdate = storageEntries.filter((obj) => {
      const dbObj = dbMap.get(obj.objectKey.value);
      return dbObj !== undefined && !obj.etag.equals(dbObj.etag);
    });
    const toDelete = [...dbMap.values()].filter(
      (meta) => !storageMap.has(meta.objectKey.value),
    );

    for (const storageObj of toAdd) {
      const contentType = ContentType.inferFromObjectKey(storageObj.objectKey);
      await this.commandRepository.upsert(
        StoredObjectMetadata.create({
          objectKey: storageObj.objectKey,
          size: storageObj.size,
          contentType,
          etag: storageObj.etag,
        }),
      );
    }

    for (const storageObj of toUpdate) {
      const contentType = ContentType.inferFromObjectKey(storageObj.objectKey);
      await this.commandRepository.upsert(
        StoredObjectMetadata.create({
          objectKey: storageObj.objectKey,
          size: storageObj.size,
          contentType,
          etag: storageObj.etag,
        }),
        { preserveDownloadCount: true },
      );
    }

    for (const dbObj of toDelete) {
      await this.commandRepository.deleteByObjectKey(dbObj.objectKey);
    }

    return {
      added: toAdd.length,
      deleted: toDelete.length,
      updated: toUpdate.length,
    };
  }
}
