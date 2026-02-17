import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it, vi } from "vitest";
import { ETag } from "../domain/shared/etag.vo";
import { ContentType } from "../domain/stored-object/content-type.vo";
import { ObjectKey } from "../domain/stored-object/object-key.vo";
import { StoredObjectMetadata } from "../domain/stored-object/stored-object-metadata.entity";
import { SyncService } from "./sync.service";
import type { IStoredObjectMetadataCommandRepository } from "../domain/stored-object/stored-object-metadata-command-repository.interface";
import type { IStoredObjectMetadataQueryRepository } from "../domain/stored-object/stored-object-metadata-query-repository.interface";
import type {
  IStoredObjectStorage,
  StoredObjectListItem,
} from "../domain/stored-object/stored-object-storage.interface";

describe("SyncService", () => {
  describe("execute", () => {
    it("should add new objects from storage to repository", async () => {
      const storage: IStoredObjectStorage = {
        get: vi.fn(),
        list: vi.fn().mockResolvedValue([
          {
            objectKey: ObjectKey.create("new-file.png"),
            size: 1024,
            etag: ETag.create("etag-new"),
          } satisfies StoredObjectListItem,
        ]),
      };

      const queryRepository: IStoredObjectMetadataQueryRepository = {
        findAll: vi.fn().mockResolvedValue([]),
        findByObjectKey: vi.fn(),
      };

      const commandRepository: IStoredObjectMetadataCommandRepository = {
        upsert: vi.fn().mockResolvedValue(
          StoredObjectMetadata.reconstruct({
            id: "new-id",
            objectKey: ObjectKey.create("new-file.png"),
            size: 1024,
            contentType: ContentType.create("image/png"),
            etag: ETag.create("etag-new"),
            downloadCount: 0,
            createdAt: Temporal.Now.instant(),
            updatedAt: Temporal.Now.instant(),
          }),
        ),
        deleteByObjectKey: vi.fn(),
        incrementDownloadCount: vi.fn(),
      };

      const service = new SyncService(
        storage,
        queryRepository,
        commandRepository,
      );
      const result = await service.execute();

      expect(result.added).toBe(1);
      expect(result.deleted).toBe(0);
      expect(result.updated).toBe(0);
      expect(commandRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          objectKey: expect.objectContaining({ value: "new-file.png" }),
          size: 1024,
          downloadCount: 0,
        }),
      );
    });

    it("should delete objects removed from storage", async () => {
      const storage: IStoredObjectStorage = {
        get: vi.fn(),
        list: vi.fn().mockResolvedValue([]),
      };

      const queryRepository: IStoredObjectMetadataQueryRepository = {
        findAll: vi.fn().mockResolvedValue([
          StoredObjectMetadata.reconstruct({
            id: "deleted-id",
            objectKey: ObjectKey.create("deleted-file.png"),
            size: 2048,
            contentType: ContentType.create("image/png"),
            etag: ETag.create("etag-deleted"),
            downloadCount: 5,
            createdAt: Temporal.Now.instant(),
            updatedAt: Temporal.Now.instant(),
          }),
        ]),
        findByObjectKey: vi.fn(),
      };

      const commandRepository: IStoredObjectMetadataCommandRepository = {
        upsert: vi.fn(),
        deleteByObjectKey: vi.fn(),
        incrementDownloadCount: vi.fn(),
      };

      const service = new SyncService(
        storage,
        queryRepository,
        commandRepository,
      );
      const result = await service.execute();

      expect(result.added).toBe(0);
      expect(result.deleted).toBe(1);
      expect(result.updated).toBe(0);
      expect(commandRepository.deleteByObjectKey).toHaveBeenCalledWith(
        expect.objectContaining({ value: "deleted-file.png" }),
      );
    });

    it("should update objects with changed etag", async () => {
      const objectKey = ObjectKey.create("updated-file.png");

      const storage: IStoredObjectStorage = {
        get: vi.fn(),
        list: vi.fn().mockResolvedValue([
          {
            objectKey,
            size: 3072,
            etag: ETag.create("etag-new"),
          } satisfies StoredObjectListItem,
        ]),
      };

      const queryRepository: IStoredObjectMetadataQueryRepository = {
        findAll: vi.fn().mockResolvedValue([
          StoredObjectMetadata.reconstruct({
            id: "updated-id",
            objectKey,
            size: 3072,
            contentType: ContentType.create("image/png"),
            etag: ETag.create("etag-old"),
            downloadCount: 10,
            createdAt: Temporal.Now.instant(),
            updatedAt: Temporal.Now.instant(),
          }),
        ]),
        findByObjectKey: vi.fn(),
      };

      const commandRepository: IStoredObjectMetadataCommandRepository = {
        upsert: vi.fn().mockResolvedValue(
          StoredObjectMetadata.reconstruct({
            id: "updated-id",
            objectKey,
            size: 3072,
            contentType: ContentType.create("image/png"),
            etag: ETag.create("etag-new"),
            downloadCount: 10,
            createdAt: Temporal.Now.instant(),
            updatedAt: Temporal.Now.instant(),
          }),
        ),
        deleteByObjectKey: vi.fn(),
        incrementDownloadCount: vi.fn(),
      };

      const service = new SyncService(
        storage,
        queryRepository,
        commandRepository,
      );
      const result = await service.execute();

      expect(result.added).toBe(0);
      expect(result.deleted).toBe(0);
      expect(result.updated).toBe(1);
      expect(commandRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          objectKey: expect.objectContaining({ value: "updated-file.png" }),
          etag: expect.objectContaining({ value: "etag-new" }),
        }),
        { preserveDownloadCount: true },
      );
    });

    it("should not update objects with same etag", async () => {
      const objectKey = ObjectKey.create("unchanged-file.png");
      const etag = ETag.create("etag-same");

      const storage: IStoredObjectStorage = {
        get: vi.fn(),
        list: vi.fn().mockResolvedValue([
          {
            objectKey,
            size: 4096,
            etag,
          } satisfies StoredObjectListItem,
        ]),
      };

      const queryRepository: IStoredObjectMetadataQueryRepository = {
        findAll: vi.fn().mockResolvedValue([
          StoredObjectMetadata.reconstruct({
            id: "unchanged-id",
            objectKey,
            size: 4096,
            contentType: ContentType.create("image/png"),
            etag,
            downloadCount: 15,
            createdAt: Temporal.Now.instant(),
            updatedAt: Temporal.Now.instant(),
          }),
        ]),
        findByObjectKey: vi.fn(),
      };

      const commandRepository: IStoredObjectMetadataCommandRepository = {
        upsert: vi.fn(),
        deleteByObjectKey: vi.fn(),
        incrementDownloadCount: vi.fn(),
      };

      const service = new SyncService(
        storage,
        queryRepository,
        commandRepository,
      );
      const result = await service.execute();

      expect(result.added).toBe(0);
      expect(result.deleted).toBe(0);
      expect(result.updated).toBe(0);
      expect(commandRepository.upsert).not.toHaveBeenCalled();
      expect(commandRepository.deleteByObjectKey).not.toHaveBeenCalled();
    });

    it("should handle mixed operations", async () => {
      const storage: IStoredObjectStorage = {
        get: vi.fn(),
        list: vi.fn().mockResolvedValue([
          {
            objectKey: ObjectKey.create("new-file.png"),
            size: 1024,
            etag: ETag.create("etag-new"),
          },
          {
            objectKey: ObjectKey.create("updated-file.png"),
            size: 2048,
            etag: ETag.create("etag-updated-new"),
          },
          {
            objectKey: ObjectKey.create("unchanged-file.png"),
            size: 3072,
            etag: ETag.create("etag-unchanged"),
          },
        ] satisfies StoredObjectListItem[]),
      };

      const queryRepository: IStoredObjectMetadataQueryRepository = {
        findAll: vi.fn().mockResolvedValue([
          StoredObjectMetadata.reconstruct({
            id: "updated-id",
            objectKey: ObjectKey.create("updated-file.png"),
            size: 2048,
            contentType: ContentType.create("image/png"),
            etag: ETag.create("etag-updated-old"),
            downloadCount: 5,
            createdAt: Temporal.Now.instant(),
            updatedAt: Temporal.Now.instant(),
          }),
          StoredObjectMetadata.reconstruct({
            id: "unchanged-id",
            objectKey: ObjectKey.create("unchanged-file.png"),
            size: 3072,
            contentType: ContentType.create("image/png"),
            etag: ETag.create("etag-unchanged"),
            downloadCount: 10,
            createdAt: Temporal.Now.instant(),
            updatedAt: Temporal.Now.instant(),
          }),
          StoredObjectMetadata.reconstruct({
            id: "deleted-id",
            objectKey: ObjectKey.create("deleted-file.png"),
            size: 4096,
            contentType: ContentType.create("image/png"),
            etag: ETag.create("etag-deleted"),
            downloadCount: 15,
            createdAt: Temporal.Now.instant(),
            updatedAt: Temporal.Now.instant(),
          }),
        ]),
        findByObjectKey: vi.fn(),
      };

      const commandRepository: IStoredObjectMetadataCommandRepository = {
        upsert: vi.fn().mockResolvedValue(
          StoredObjectMetadata.reconstruct({
            id: "mock-id",
            objectKey: ObjectKey.create("mock.png"),
            size: 1024,
            contentType: ContentType.create("image/png"),
            etag: ETag.create("etag-mock"),
            downloadCount: 0,
            createdAt: Temporal.Now.instant(),
            updatedAt: Temporal.Now.instant(),
          }),
        ),
        deleteByObjectKey: vi.fn(),
        incrementDownloadCount: vi.fn(),
      };

      const service = new SyncService(
        storage,
        queryRepository,
        commandRepository,
      );
      const result = await service.execute();

      expect(result.added).toBe(1);
      expect(result.deleted).toBe(1);
      expect(result.updated).toBe(1);
    });
  });
});
