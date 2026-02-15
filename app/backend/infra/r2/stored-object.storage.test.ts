import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentType } from "../../domain/stored-object/content-type.vo";
import { ETag } from "../../domain/stored-object/etag.vo";
import { ObjectKey } from "../../domain/stored-object/object-key.vo";
import { StoredObjectStorage } from "./stored-object.storage";

describe("StoredObjectStorage", () => {
  let mockR2Bucket: R2Bucket;

  beforeEach(() => {
    mockR2Bucket = {
      get: vi.fn(),
    } as unknown as R2Bucket;
  });

  const createMockR2Object = (
    key: string,
    size: number,
    etag: string,
    contentType?: string,
  ): R2ObjectBody => ({
    key,
    size,
    etag,
    httpEtag: `"${etag}"`,
    httpMetadata: {
      contentType,
    },
    body: new ReadableStream(),
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    text: vi.fn(),
    json: vi.fn(),
    blob: vi.fn(),
    bytes: vi.fn(),
    checksums: {
      toJSON: vi.fn(),
    },
    uploaded: new Date(),
    version: "v1",
    storageClass: "Standard",
    range: undefined,
    customMetadata: {},
    writeHttpMetadata: vi.fn(),
  });

  describe("get", () => {
    it("should return StoredObjectContent when object exists in R2", async () => {
      // Arrange
      const objectKey = ObjectKey.create("test.png");
      const mockR2Object = createMockR2Object(
        "test.png",
        1024,
        "abc123",
        "image/png",
      );

      vi.mocked(mockR2Bucket.get).mockResolvedValue(mockR2Object);

      const storage = new StoredObjectStorage(mockR2Bucket);

      // Act
      const result = await storage.get(objectKey);

      // Assert
      expect(mockR2Bucket.get).toHaveBeenCalledWith("test.png");
      expect(result).toBeDefined();
      expect(result?.body).toBe(mockR2Object.body);
      expect(result?.contentType).toEqual(ContentType.create("image/png"));
      expect(result?.size).toBe(1024);
      expect(result?.etag).toEqual(ETag.create("abc123"));
    });

    it("should return undefined when object does not exist in R2", async () => {
      // Arrange
      const objectKey = ObjectKey.create("nonexistent.png");
      vi.mocked(mockR2Bucket.get).mockResolvedValue(null);

      const storage = new StoredObjectStorage(mockR2Bucket);

      // Act
      const result = await storage.get(objectKey);

      // Assert
      expect(mockR2Bucket.get).toHaveBeenCalledWith("nonexistent.png");
      expect(result).toBeUndefined();
    });

    it("should infer content type from file extension when not set in R2", async () => {
      // Arrange
      const objectKey = ObjectKey.create("document.md");
      const mockR2Object = createMockR2Object("document.md", 512, "def456");

      vi.mocked(mockR2Bucket.get).mockResolvedValue(mockR2Object);

      const storage = new StoredObjectStorage(mockR2Bucket);

      // Act
      const result = await storage.get(objectKey);

      // Assert
      expect(result).toBeDefined();
      expect(result?.contentType).toEqual(ContentType.create("text/markdown"));
    });

    it("should use application/octet-stream as fallback when content type cannot be inferred", async () => {
      // Arrange
      const objectKey = ObjectKey.create("file.unknown");
      const mockR2Object = createMockR2Object("file.unknown", 256, "ghi789");

      vi.mocked(mockR2Bucket.get).mockResolvedValue(mockR2Object);

      const storage = new StoredObjectStorage(mockR2Bucket);

      // Act
      const result = await storage.get(objectKey);

      // Assert
      expect(result).toBeDefined();
      expect(result?.contentType).toEqual(
        ContentType.create("application/octet-stream"),
      );
    });

    it("should handle multiple common file extensions correctly", async () => {
      // Arrange
      const testCases = [
        { key: "image.jpg", expected: "image/jpeg" },
        { key: "image.jpeg", expected: "image/jpeg" },
        { key: "image.png", expected: "image/png" },
        { key: "image.gif", expected: "image/gif" },
        { key: "image.webp", expected: "image/webp" },
        { key: "doc.txt", expected: "text/plain" },
        { key: "doc.md", expected: "text/markdown" },
        { key: "doc.html", expected: "text/html" },
        { key: "data.json", expected: "application/json" },
      ];

      const storage = new StoredObjectStorage(mockR2Bucket);

      for (const testCase of testCases) {
        const objectKey = ObjectKey.create(testCase.key);
        const mockR2Object = createMockR2Object(testCase.key, 100, "test");

        vi.mocked(mockR2Bucket.get).mockResolvedValue(mockR2Object);

        // Act
        const result = await storage.get(objectKey);

        // Assert
        expect(result?.contentType).toEqual(
          ContentType.create(testCase.expected),
        );
      }
    });
  });
});
