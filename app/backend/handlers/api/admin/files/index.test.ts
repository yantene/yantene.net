import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { adminFilesApp } from ".";

// Mock drizzle
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(),
    insert: vi.fn(),
  })),
}));

// Mock SyncService
vi.mock("../../../../services/sync.service", () => ({
  SyncService: vi.fn(function (this: unknown) {
    return {
      execute: vi.fn().mockResolvedValue({
        added: 2,
        deleted: 1,
        updated: 1,
      }),
    };
  }),
}));

// Mock repository
vi.mock(
  "../../../../infra/d1/stored-object/stored-object-metadata.repository",
  () => ({
    StoredObjectMetadataRepository: vi.fn(function (this: unknown) {
      return {
        findAll: vi.fn(),
        findByObjectKey: vi.fn(),
        upsert: vi.fn(),
        deleteByObjectKey: vi.fn(),
        incrementDownloadCount: vi.fn(),
      };
    }),
  }),
);

// Mock storage
vi.mock("../../../../infra/r2/stored-object.storage", () => ({
  StoredObjectStorage: vi.fn(function (this: unknown) {
    return {
      get: vi.fn(),
      list: vi.fn(),
    };
  }),
}));

describe("Admin Files API Handler", () => {
  describe("POST /api/admin/files/sync", () => {
    it("should execute sync and return result", async () => {
      const app = new Hono<{ Bindings: Env }>().route(
        "/api/admin/files",
        adminFilesApp,
      );

      const res = await app.request(
        "/api/admin/files/sync",
        {
          method: "POST",
        },
        {
          D1: {} as D1Database,
          R2: {} as R2Bucket,
          VALUE_FROM_CLOUDFLARE: "test",
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toMatchObject({
        added: 2,
        deleted: 1,
        updated: 1,
      });
    });

    it("should return 500 when sync throws", async () => {
      const { SyncService: syncService } = await import("../../../../services/sync.service");

      vi.mocked(syncService).mockImplementationOnce(function (this: unknown) {
        return {
          execute: vi.fn().mockRejectedValue(new Error("Sync failed")),
        };
      });

      const app = new Hono<{ Bindings: Env }>().route(
        "/api/admin/files",
        adminFilesApp,
      );

      const res = await app.request(
        "/api/admin/files/sync",
        {
          method: "POST",
        },
        {
          D1: {} as D1Database,
          R2: {} as R2Bucket,
          VALUE_FROM_CLOUDFLARE: "test",
        },
      );

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toHaveProperty("error");
    });
  });
});
