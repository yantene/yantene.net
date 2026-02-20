import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoteSlug } from "../../../domain/note/note-slug.vo";
import { ETag } from "../../../domain/shared/etag.vo";
import { MarkdownStorage } from "./markdown.storage";

describe("MarkdownStorage", () => {
  let mockR2Bucket: R2Bucket;

  beforeEach(() => {
    mockR2Bucket = {
      get: vi.fn(),
      list: vi.fn(),
    } as unknown as R2Bucket;
  });

  describe("get", () => {
    it("should return MarkdownContent when markdown exists at notes/{slug}.md", async () => {
      const slug = NoteSlug.create("my-article");
      const mockBody = new ReadableStream();
      const mockR2Object = {
        body: mockBody,
        etag: "abc123",
      } as unknown as R2ObjectBody;

      vi.mocked(mockR2Bucket.get).mockResolvedValue(mockR2Object);

      const storage = new MarkdownStorage(mockR2Bucket);
      const result = await storage.get(slug);

      expect(mockR2Bucket.get).toHaveBeenCalledWith("notes/my-article.md");
      expect(result).toBeDefined();
      expect(result?.body).toBe(mockBody);
      expect(result?.etag).toEqual(ETag.create("abc123"));
    });

    it("should return undefined when markdown does not exist", async () => {
      const slug = NoteSlug.create("nonexistent");
      vi.mocked(mockR2Bucket.get).mockResolvedValue(null);

      const storage = new MarkdownStorage(mockR2Bucket);
      const result = await storage.get(slug);

      expect(mockR2Bucket.get).toHaveBeenCalledWith("notes/nonexistent.md");
      expect(result).toBeUndefined();
    });
  });

  describe("list", () => {
    it("should return MarkdownListItem array with slugs extracted from keys", async () => {
      const mockR2Objects: R2Objects = {
        objects: [
          createMockR2Object("notes/first-article.md", "etag1"),
          createMockR2Object("notes/second-article.md", "etag2"),
        ],
        truncated: false,
        delimitedPrefixes: [],
      };

      vi.mocked(mockR2Bucket.list).mockResolvedValue(mockR2Objects);

      const storage = new MarkdownStorage(mockR2Bucket);
      const result = await storage.list();

      expect(mockR2Bucket.list).toHaveBeenCalledWith({ prefix: "notes/" });
      expect(result).toHaveLength(2);
      expect(result[0].slug).toEqual(NoteSlug.create("first-article"));
      expect(result[0].etag).toEqual(ETag.create("etag1"));
      expect(result[1].slug).toEqual(NoteSlug.create("second-article"));
      expect(result[1].etag).toEqual(ETag.create("etag2"));
    });

    it("should filter out non-.md files from listing", async () => {
      const mockR2Objects: R2Objects = {
        objects: [
          createMockR2Object("notes/article.md", "etag1"),
          createMockR2Object("notes/image.png", "etag2"),
          createMockR2Object("notes/photo.jpg", "etag3"),
        ],
        truncated: false,
        delimitedPrefixes: [],
      };

      vi.mocked(mockR2Bucket.list).mockResolvedValue(mockR2Objects);

      const storage = new MarkdownStorage(mockR2Bucket);
      const result = await storage.list();

      expect(result).toHaveLength(1);
      expect(result[0].slug).toEqual(NoteSlug.create("article"));
    });

    it("should skip markdown files in subdirectories (slug containing slash)", async () => {
      const mockR2Objects: R2Objects = {
        objects: [
          createMockR2Object("notes/valid-article.md", "etag1"),
          createMockR2Object("notes/subdir/nested.md", "etag2"),
          createMockR2Object("notes/deep/path/file.md", "etag3"),
        ],
        truncated: false,
        delimitedPrefixes: [],
      };

      vi.mocked(mockR2Bucket.list).mockResolvedValue(mockR2Objects);

      const storage = new MarkdownStorage(mockR2Bucket);
      const result = await storage.list();

      expect(result).toHaveLength(1);
      expect(result[0].slug).toEqual(NoteSlug.create("valid-article"));
    });

    it("should return empty array when no markdown files exist", async () => {
      const mockR2Objects: R2Objects = {
        objects: [],
        truncated: false,
        delimitedPrefixes: [],
      };

      vi.mocked(mockR2Bucket.list).mockResolvedValue(mockR2Objects);

      const storage = new MarkdownStorage(mockR2Bucket);
      const result = await storage.list();

      expect(result).toHaveLength(0);
    });
  });
});

function createMockR2Object(key: string, etag: string): R2Object {
  return {
    key,
    etag,
    size: 100,
    httpEtag: `"${etag}"`,
    uploaded: new Date(),
    version: "v1",
    storageClass: "Standard",
    checksums: { toJSON: vi.fn() },
    customMetadata: {},
    httpMetadata: {},
    writeHttpMetadata: vi.fn(),
  } as unknown as R2Object;
}
