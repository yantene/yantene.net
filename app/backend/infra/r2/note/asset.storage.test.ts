import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentType } from "../../../domain/shared/content-type.vo";
import { ETag } from "../../../domain/shared/etag.vo";
import { ObjectKey } from "../../../domain/shared/object-key.vo";
import { AssetStorage } from "./asset.storage";

describe("AssetStorage", () => {
  let mockR2Bucket: R2Bucket;

  beforeEach(() => {
    mockR2Bucket = {
      get: vi.fn(),
      list: vi.fn(),
    } as unknown as R2Bucket;
  });

  describe("get", () => {
    it("should return AssetContent when asset exists at notes/{objectKey}", async () => {
      const objectKey = ObjectKey.create("image.png");
      const mockBody = new ReadableStream();
      const mockR2Object = {
        body: mockBody,
        etag: "abc123",
        size: 2048,
        httpMetadata: { contentType: "image/png" },
      } as unknown as R2ObjectBody;

      vi.mocked(mockR2Bucket.get).mockResolvedValue(mockR2Object);

      const storage = new AssetStorage(mockR2Bucket);
      const result = await storage.get(objectKey);

      expect(mockR2Bucket.get).toHaveBeenCalledWith("notes/image.png");
      expect(result).toBeDefined();
      expect(result?.body).toBe(mockBody);
      expect(result?.contentType).toEqual(ContentType.create("image/png"));
      expect(result?.size).toBe(2048);
      expect(result?.etag).toEqual(ETag.create("abc123"));
    });

    it("should return undefined when asset does not exist", async () => {
      const objectKey = ObjectKey.create("nonexistent.png");
      vi.mocked(mockR2Bucket.get).mockResolvedValue(null);

      const storage = new AssetStorage(mockR2Bucket);
      const result = await storage.get(objectKey);

      expect(mockR2Bucket.get).toHaveBeenCalledWith("notes/nonexistent.png");
      expect(result).toBeUndefined();
    });

    it("should infer contentType from objectKey when R2 metadata is missing", async () => {
      const objectKey = ObjectKey.create("photo.jpg");
      const mockR2Object = {
        body: new ReadableStream(),
        etag: "def456",
        size: 1024,
        httpMetadata: {},
      } as unknown as R2ObjectBody;

      vi.mocked(mockR2Bucket.get).mockResolvedValue(mockR2Object);

      const storage = new AssetStorage(mockR2Bucket);
      const result = await storage.get(objectKey);

      expect(result?.contentType).toEqual(ContentType.create("image/jpeg"));
    });
  });

  describe("list", () => {
    it("should return AssetListItem array excluding .md files", async () => {
      const mockR2Objects: R2Objects = {
        objects: [
          createMockR2Object("notes/article.md", 500, "etag1"),
          createMockR2Object("notes/image.png", 2048, "etag2", "image/png"),
          createMockR2Object("notes/photo.jpg", 1024, "etag3", "image/jpeg"),
        ],
        truncated: false,
        delimitedPrefixes: [],
      };

      vi.mocked(mockR2Bucket.list).mockResolvedValue(mockR2Objects);

      const storage = new AssetStorage(mockR2Bucket);
      const result = await storage.list();

      expect(mockR2Bucket.list).toHaveBeenCalledWith({ prefix: "notes/" });
      expect(result).toHaveLength(2);
      expect(result[0].objectKey).toEqual(ObjectKey.create("image.png"));
      expect(result[0].size).toBe(2048);
      expect(result[0].contentType).toEqual(ContentType.create("image/png"));
      expect(result[0].etag).toEqual(ETag.create("etag2"));
      expect(result[1].objectKey).toEqual(ObjectKey.create("photo.jpg"));
    });

    it("should strip notes/ prefix from objectKey in list items", async () => {
      const mockR2Objects: R2Objects = {
        objects: [
          createMockR2Object(
            "notes/subdir/image.png",
            512,
            "etag1",
            "image/png",
          ),
        ],
        truncated: false,
        delimitedPrefixes: [],
      };

      vi.mocked(mockR2Bucket.list).mockResolvedValue(mockR2Objects);

      const storage = new AssetStorage(mockR2Bucket);
      const result = await storage.list();

      expect(result[0].objectKey).toEqual(ObjectKey.create("subdir/image.png"));
    });

    it("should return empty array when no asset files exist", async () => {
      const mockR2Objects: R2Objects = {
        objects: [createMockR2Object("notes/article.md", 500, "etag1")],
        truncated: false,
        delimitedPrefixes: [],
      };

      vi.mocked(mockR2Bucket.list).mockResolvedValue(mockR2Objects);

      const storage = new AssetStorage(mockR2Bucket);
      const result = await storage.list();

      expect(result).toHaveLength(0);
    });

    it("should infer contentType from objectKey when R2 metadata is missing", async () => {
      const mockR2Objects: R2Objects = {
        objects: [createMockR2Object("notes/image.webp", 1024, "etag1")],
        truncated: false,
        delimitedPrefixes: [],
      };

      vi.mocked(mockR2Bucket.list).mockResolvedValue(mockR2Objects);

      const storage = new AssetStorage(mockR2Bucket);
      const result = await storage.list();

      expect(result[0].contentType).toEqual(ContentType.create("image/webp"));
    });
  });
});

function createMockR2Object(
  key: string,
  size: number,
  etag: string,
  contentType?: string,
): R2Object {
  return {
    key,
    size,
    etag,
    httpEtag: `"${etag}"`,
    uploaded: new Date(),
    version: "v1",
    storageClass: "Standard",
    checksums: { toJSON: vi.fn() },
    customMetadata: {},
    httpMetadata: contentType ? { contentType } : {},
    writeHttpMetadata: vi.fn(),
  } as unknown as R2Object;
}
