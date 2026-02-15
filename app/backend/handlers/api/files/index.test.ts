import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { filesApp } from ".";
import { ContentType } from "../../../domain/stored-object/content-type.vo";
import { ETag } from "../../../domain/stored-object/etag.vo";
import { ObjectKey } from "../../../domain/stored-object/object-key.vo";
import { StoredObjectMetadata } from "../../../domain/stored-object/stored-object-metadata.entity";

// Mock drizzle
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(),
    insert: vi.fn(),
  })),
}));

// Mock repository
vi.mock("../../../infra/d1/stored-object/stored-object-metadata.repository", () => ({
  StoredObjectMetadataRepository: vi.fn(function (this: unknown) {
    return {
      findAll: vi.fn().mockResolvedValue([
        StoredObjectMetadata.reconstruct({
          id: "test-id",
          objectKey: ObjectKey.create("test.png"),
          size: 1024,
          contentType: ContentType.create("image/png"),
          etag: ETag.create("test-etag"),
          downloadCount: 5,
          createdAt: Temporal.Now.instant(),
          updatedAt: Temporal.Now.instant(),
        }),
      ]),
      findByObjectKey: vi.fn(),
      upsert: vi.fn(),
      deleteByObjectKey: vi.fn(),
      incrementDownloadCount: vi.fn(),
    };
  }),
}));

// Mock storage
vi.mock("../../../infra/r2/stored-object.storage", () => ({
  StoredObjectStorage: vi.fn(function (this: unknown) {
    return {
      get: vi.fn().mockResolvedValue({
        body: new ReadableStream(),
        contentType: ContentType.create("image/png"),
        size: 1024,
        etag: ETag.create("test-etag"),
      }),
      list: vi.fn(),
    };
  }),
}));

describe("Files API Handler", () => {
  describe("GET /api/files", () => {
    it("should return file list", async () => {
      const app = new Hono<{ Bindings: Env }>().route("/api/files", filesApp);

      const res = await app.request("/api/files", {
        method: "GET",
      }, {
        D1: {} as D1Database,
        R2: {} as R2Bucket,
        VALUE_FROM_CLOUDFLARE: "test",
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { files: unknown[] };
      expect(json).toHaveProperty("files");
      expect(Array.isArray(json.files)).toBe(true);
      expect(json.files).toHaveLength(1);
      expect(json.files[0]).toMatchObject({
        key: "test.png",
        size: 1024,
        contentType: "image/png",
        downloadCount: 5,
      });
    });

    it("should return 500 when repository throws", async () => {
      const { StoredObjectMetadataRepository } = await import(
        "../../../infra/d1/stored-object/stored-object-metadata.repository"
      );

      vi.mocked(StoredObjectMetadataRepository).mockImplementationOnce(function (this: unknown) {
        return {
          findAll: vi.fn().mockRejectedValue(new Error("DB error")),
          findByObjectKey: vi.fn(),
          upsert: vi.fn(),
          deleteByObjectKey: vi.fn(),
          incrementDownloadCount: vi.fn(),
        };
      });

      const app = new Hono<{ Bindings: Env }>().route("/api/files", filesApp);

      const res = await app.request("/api/files", {
        method: "GET",
      }, {
        D1: {} as D1Database,
        R2: {} as R2Bucket,
        VALUE_FROM_CLOUDFLARE: "test",
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toHaveProperty("error");
    });
  });

  describe("GET /files/:key", () => {
    it("should return file content with proper headers", async () => {
      const { StoredObjectMetadataRepository } = await import(
        "../../../infra/d1/stored-object/stored-object-metadata.repository"
      );

      vi.mocked(StoredObjectMetadataRepository).mockImplementationOnce(function (this: unknown) {
        return {
          findAll: vi.fn(),
          findByObjectKey: vi.fn().mockResolvedValue(
            StoredObjectMetadata.reconstruct({
              id: "test-id",
              objectKey: ObjectKey.create("test.png"),
              size: 1024,
              contentType: ContentType.create("image/png"),
              etag: ETag.create("test-etag"),
              downloadCount: 5,
              createdAt: Temporal.Now.instant(),
              updatedAt: Temporal.Now.instant(),
            }),
          ),
          upsert: vi.fn(),
          deleteByObjectKey: vi.fn(),
          incrementDownloadCount: vi.fn(),
        };
      });

      const app = new Hono<{ Bindings: Env }>().route("/files", filesApp);

      const res = await app.request("/files/test.png", {
        method: "GET",
      }, {
        D1: {} as D1Database,
        R2: {} as R2Bucket,
        VALUE_FROM_CLOUDFLARE: "test",
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      expect(res.headers.get("Content-Disposition")).toContain("attachment");
      expect(res.headers.get("Content-Disposition")).toContain("test.png");
    });

    it("should return 404 when metadata not found", async () => {
      const { StoredObjectMetadataRepository } = await import(
        "../../../infra/d1/stored-object/stored-object-metadata.repository"
      );

      vi.mocked(StoredObjectMetadataRepository).mockImplementationOnce(function (this: unknown) {
        return {
          findAll: vi.fn(),
          findByObjectKey: vi.fn().mockResolvedValue(undefined),
          upsert: vi.fn(),
          deleteByObjectKey: vi.fn(),
          incrementDownloadCount: vi.fn(),
        };
      });

      const app = new Hono<{ Bindings: Env }>().route("/files", filesApp);

      const res = await app.request("/files/notfound.png", {
        method: "GET",
      }, {
        D1: {} as D1Database,
        R2: {} as R2Bucket,
        VALUE_FROM_CLOUDFLARE: "test",
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json).toHaveProperty("error");
    });

    it("should return 500 when storage returns undefined", async () => {
      const { StoredObjectMetadataRepository } = await import(
        "../../../infra/d1/stored-object/stored-object-metadata.repository"
      );
      const { StoredObjectStorage } = await import(
        "../../../infra/r2/stored-object.storage"
      );

      vi.mocked(StoredObjectMetadataRepository).mockImplementationOnce(function (this: unknown) {
        return {
          findAll: vi.fn(),
          findByObjectKey: vi.fn().mockResolvedValue(
            StoredObjectMetadata.reconstruct({
              id: "test-id",
              objectKey: ObjectKey.create("test.png"),
              size: 1024,
              contentType: ContentType.create("image/png"),
              etag: ETag.create("test-etag"),
              downloadCount: 5,
              createdAt: Temporal.Now.instant(),
              updatedAt: Temporal.Now.instant(),
            }),
          ),
          upsert: vi.fn(),
          deleteByObjectKey: vi.fn(),
          incrementDownloadCount: vi.fn(),
        };
      });

      vi.mocked(StoredObjectStorage).mockImplementationOnce(function (this: unknown) {
        return {
          get: vi.fn().mockResolvedValue(undefined),
          list: vi.fn(),
        };
      });

      const app = new Hono<{ Bindings: Env }>().route("/files", filesApp);

      const res = await app.request("/files/test.png", {
        method: "GET",
      }, {
        D1: {} as D1Database,
        R2: {} as R2Bucket,
        VALUE_FROM_CLOUDFLARE: "test",
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toHaveProperty("error");
    });
  });
});
