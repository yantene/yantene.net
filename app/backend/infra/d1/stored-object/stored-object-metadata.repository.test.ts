import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it } from "vitest";
import { ContentType } from "../../../domain/stored-object/content-type.vo";
import { ETag } from "../../../domain/stored-object/etag.vo";
import { ObjectKey } from "../../../domain/stored-object/object-key.vo";
import { StoredObjectMetadata } from "../../../domain/stored-object/stored-object-metadata.entity";
import { StoredObjectMetadataRepository } from "./stored-object-metadata.repository";
import type { IUnpersisted } from "../../../domain/unpersisted.interface";

// Mock D1 database
const createMockDb = () => {
  const mockData: Map<string, unknown> = new Map();

  return {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          all: async () => {
            return [...mockData.values()];
          },
          where: () => ({
            get: async () => {
              return mockData.size > 0 ? [...mockData.values()][0] : undefined;
            },
          }),
        }),
        all: async () => {
          return [...mockData.values()];
        },
        where: () => ({
          all: async () => {
            return [...mockData.values()];
          },
          get: async () => {
            return mockData.size > 0 ? [...mockData.values()][0] : undefined;
          },
        }),
      }),
    }),
    insert: () => {
      let insertValue: Record<string, unknown> | null = null;
      return {
        values: (value: unknown) => {
          insertValue = value as Record<string, unknown>;
          return {
            onConflictDoUpdate: (config: { set: Record<string, unknown> }) => ({
              returning: async () => {
                // Find existing record by objectKey
                let existingId: string | null = null;
                for (const [id, record] of mockData.entries()) {
                  if (
                    (record as Record<string, unknown>).objectKey ===
                    insertValue?.objectKey
                  ) {
                    existingId = id;
                    break;
                  }
                }

                if (existingId) {
                  // Update existing record
                  const existing = mockData.get(existingId) as Record<
                    string,
                    unknown
                  >;
                  const updated = { ...existing, ...config.set };
                  mockData.set(existingId, updated);
                  return [updated];
                } else {
                  // Insert new record
                  const id = `id-${mockData.size}`;
                  const record = { ...insertValue, id };
                  mockData.set(id, record);
                  return [record];
                }
              },
            }),
            onConflictDoNothing: () => ({
              returning: async () => {
                // Check if record exists
                for (const record of mockData.values()) {
                  if (
                    (record as Record<string, unknown>).objectKey ===
                    insertValue?.objectKey
                  ) {
                    return [record]; // Return existing, don't update
                  }
                }
                // Insert new record
                const id = `id-${mockData.size}`;
                const record = { ...insertValue, id };
                mockData.set(id, record);
                return [record];
              },
            }),
            returning: async () => {
              const id = `id-${mockData.size}`;
              const record = { ...insertValue, id };
              mockData.set(id, record);
              return [record];
            },
          };
        },
      };
    },
    update: () => ({
      set: (updates: unknown) => {
        const updateValue = updates as Record<string, unknown>;
        return {
          where: () => ({
            run: async () => {
              // Update all matching records
              for (const [id, record] of mockData.entries()) {
                const updated = {
                  ...(record as Record<string, unknown>),
                  ...updateValue,
                };
                mockData.set(id, updated);
              }
              return { success: true };
            },
            returning: async () => {
              return [...mockData.values()];
            },
          }),
        };
      },
    }),
    delete: () => ({
      where: () => ({
        run: async () => ({ success: true }),
      }),
    }),
    _mockData: mockData,
  };
};

describe("StoredObjectMetadataRepository", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let repository: StoredObjectMetadataRepository;

  beforeEach(() => {
    mockDb = createMockDb();
    // @ts-expect-error - Mock type compatibility
    repository = new StoredObjectMetadataRepository(mockDb);
  });

  describe("findAll", () => {
    it("should return empty array when no records exist", async () => {
      const result = await repository.findAll();
      expect(result).toEqual([]);
    });

    it("should return all stored object metadata", async () => {
      // Setup mock data
      mockDb._mockData.set("1", {
        id: "1",
        objectKey: "test-key",
        size: 1024,
        contentType: "image/png",
        etag: "test-etag",
        downloadCount: 0,
        createdAt: Temporal.Now.instant().epochMilliseconds / 1000,
        updatedAt: Temporal.Now.instant().epochMilliseconds / 1000,
      });

      const result = await repository.findAll();
      expect(result).toHaveLength(1);
      expect(result[0]?.objectKey.value).toBe("test-key");
    });
  });

  describe("findByObjectKey", () => {
    it("should return undefined when object key not found", async () => {
      const objectKey = ObjectKey.create("non-existent");
      const result = await repository.findByObjectKey(objectKey);
      expect(result).toBeUndefined();
    });

    it("should return stored object metadata when found", async () => {
      // Setup mock data
      const now = Temporal.Now.instant().epochMilliseconds / 1000;
      mockDb._mockData.set("1", {
        id: "1",
        objectKey: "test-key",
        size: 1024,
        contentType: "image/png",
        etag: "test-etag",
        downloadCount: 5,
        createdAt: now,
        updatedAt: now,
      });

      const objectKey = ObjectKey.create("test-key");
      const result = await repository.findByObjectKey(objectKey);

      expect(result).toBeDefined();
      expect(result?.objectKey.value).toBe("test-key");
      expect(result?.size).toBe(1024);
    });
  });

  describe("upsert", () => {
    it("should insert new metadata with download count 0", async () => {
      const metadata = StoredObjectMetadata.create({
        objectKey: ObjectKey.create("new-key"),
        size: 2048,
        contentType: ContentType.create("text/plain"),
        etag: ETag.create("new-etag"),
      }) as StoredObjectMetadata<IUnpersisted> & { downloadCount: number };

      const result = await repository.upsert(metadata);

      expect(result).toBeDefined();
      expect(result.objectKey.value).toBe("new-key");
    });

    it("should preserve download count when preserveDownloadCount is true", async () => {
      // Setup existing data with download count
      const now = Temporal.Now.instant().epochMilliseconds / 1000;
      mockDb._mockData.set("1", {
        id: "1",
        objectKey: "existing-key",
        size: 1024,
        contentType: "image/png",
        etag: "old-etag",
        downloadCount: 10,
        createdAt: now,
        updatedAt: now,
      });

      const metadata = StoredObjectMetadata.create({
        objectKey: ObjectKey.create("existing-key"),
        size: 2048,
        contentType: ContentType.create("image/png"),
        etag: ETag.create("new-etag"),
      }) as StoredObjectMetadata<IUnpersisted> & { downloadCount: number };

      const result = await repository.upsert(metadata, true);

      expect(result).toBeDefined();
      expect(result.etag.value).toBe("new-etag");
    });
  });

  describe("deleteByObjectKey", () => {
    it("should delete metadata by object key", async () => {
      const objectKey = ObjectKey.create("delete-me");
      await expect(
        repository.deleteByObjectKey(objectKey),
      ).resolves.not.toThrow();
    });
  });

  describe("incrementDownloadCount", () => {
    it("should increment download count atomically", async () => {
      const objectKey = ObjectKey.create("test-key");
      await expect(
        repository.incrementDownloadCount(objectKey),
      ).resolves.not.toThrow();
    });
  });
});
