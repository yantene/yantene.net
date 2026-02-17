import { Temporal } from "@js-temporal/polyfill";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { ContentType } from "../../../domain/stored-object/content-type.vo";
import { ETag } from "../../../domain/stored-object/etag.vo";
import { ObjectKey } from "../../../domain/stored-object/object-key.vo";
import { StoredObjectMetadata } from "../../../domain/stored-object/stored-object-metadata.entity";
import { filesApp } from ".";

// Mock drizzle
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(),
    insert: vi.fn(),
  })),
}));

// Mock query repository
vi.mock(
  "../../../infra/d1/stored-object/stored-object-metadata.query-repository",
  () => ({
    StoredObjectMetadataQueryRepository: vi.fn(function (this: unknown) {
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
      };
    }),
  }),
);

// Mock command repository
vi.mock(
  "../../../infra/d1/stored-object/stored-object-metadata.command-repository",
  () => ({
    StoredObjectMetadataCommandRepository: vi.fn(function (this: unknown) {
      return {
        upsert: vi.fn(),
        deleteByObjectKey: vi.fn(),
        incrementDownloadCount: vi.fn(),
      };
    }),
  }),
);

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

      const res = await app.request(
        "/api/files",
        {
          method: "GET",
        },
        {
          D1: {} as D1Database,
          R2: {} as R2Bucket,
          VALUE_FROM_CLOUDFLARE: "test",
        },
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
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
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { StoredObjectMetadataQueryRepository } =
        await import("../../../infra/d1/stored-object/stored-object-metadata.query-repository");

      vi.mocked(StoredObjectMetadataQueryRepository).mockImplementationOnce(
        function (this: unknown) {
          return {
            findAll: vi.fn().mockRejectedValue(new Error("DB error")),
            findByObjectKey: vi.fn(),
          };
        },
      );

      const app = new Hono<{ Bindings: Env }>().route("/api/files", filesApp);

      const res = await app.request(
        "/api/files",
        {
          method: "GET",
        },
        {
          D1: {} as D1Database,
          R2: {} as R2Bucket,
          VALUE_FROM_CLOUDFLARE: "test",
        },
      );

      expect(res.status).toBe(500);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const json = (await res.json()) as { error: string };
      expect(json).toHaveProperty("error");
    });
  });

  describe("GET /files/:key", () => {
    it("should return file content with proper headers", async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { StoredObjectMetadataQueryRepository } =
        await import("../../../infra/d1/stored-object/stored-object-metadata.query-repository");

      vi.mocked(StoredObjectMetadataQueryRepository).mockImplementationOnce(
        function (this: unknown) {
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
          };
        },
      );

      const app = new Hono<{ Bindings: Env }>().route("/api/files", filesApp);

      const res = await app.request(
        "/api/files/test.png",
        {
          method: "GET",
        },
        {
          D1: {} as D1Database,
          R2: {} as R2Bucket,
          VALUE_FROM_CLOUDFLARE: "test",
        },
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      expect(res.headers.get("Content-Disposition")).toContain("attachment");
      expect(res.headers.get("Content-Disposition")).toContain("test.png");
    });

    it("should return 404 when metadata not found", async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { StoredObjectMetadataQueryRepository } =
        await import("../../../infra/d1/stored-object/stored-object-metadata.query-repository");

      vi.mocked(StoredObjectMetadataQueryRepository).mockImplementationOnce(
        function (this: unknown) {
          return {
            findAll: vi.fn(),
            // eslint-disable-next-line unicorn/no-useless-undefined
            findByObjectKey: vi.fn().mockResolvedValue(undefined),
          };
        },
      );

      const app = new Hono<{ Bindings: Env }>().route("/api/files", filesApp);

      const res = await app.request(
        "/api/files/notfound.png",
        {
          method: "GET",
        },
        {
          D1: {} as D1Database,
          R2: {} as R2Bucket,
          VALUE_FROM_CLOUDFLARE: "test",
        },
      );

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json).toHaveProperty("error");
    });

    it("should return 500 when storage returns undefined", async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { StoredObjectMetadataQueryRepository } =
        await import("../../../infra/d1/stored-object/stored-object-metadata.query-repository");
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { StoredObjectStorage } =
        await import("../../../infra/r2/stored-object.storage");

      vi.mocked(StoredObjectMetadataQueryRepository).mockImplementationOnce(
        function (this: unknown) {
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
          };
        },
      );

      vi.mocked(StoredObjectStorage).mockImplementationOnce(function (
        this: unknown,
      ) {
        return {
          // eslint-disable-next-line unicorn/no-useless-undefined
          get: vi.fn().mockResolvedValue(undefined),
          list: vi.fn(),
        };
      });

      const app = new Hono<{ Bindings: Env }>().route("/api/files", filesApp);

      const res = await app.request(
        "/api/files/test.png",
        {
          method: "GET",
        },
        {
          D1: {} as D1Database,
          R2: {} as R2Bucket,
          VALUE_FROM_CLOUDFLARE: "test",
        },
      );

      expect(res.status).toBe(500);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const json = (await res.json()) as { error: string };
      expect(json).toHaveProperty("error");
    });
  });
});
