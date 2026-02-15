import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { ContentType } from "./content-type.vo";
import { ETag } from "./etag.vo";
import { ObjectKey } from "./object-key.vo";
import { StoredObjectMetadata } from "./stored-object-metadata.entity";

describe("StoredObjectMetadata Entity", () => {
  const validParams = {
    objectKey: ObjectKey.create("images/photo.png"),
    size: 1024,
    contentType: ContentType.create("image/png"),
    etag: ETag.create('"abc123"'),
  };

  describe("create()", () => {
    it("should create an unpersisted entity with valid params", () => {
      const metadata = StoredObjectMetadata.create(validParams);

      expect(metadata.id).toBeUndefined();
      expect(metadata.objectKey.value).toBe("images/photo.png");
      expect(metadata.size).toBe(1024);
      expect(metadata.contentType.value).toBe("image/png");
      expect(metadata.etag.value).toBe('"abc123"');
      expect(metadata.downloadCount).toBe(0);
      expect(metadata.createdAt).toBeUndefined();
      expect(metadata.updatedAt).toBeUndefined();
    });

    it("should create an entity with size 0", () => {
      const metadata = StoredObjectMetadata.create({
        ...validParams,
        size: 0,
      });

      expect(metadata.size).toBe(0);
    });

    it("should throw an error for negative size", () => {
      expect(() =>
        StoredObjectMetadata.create({
          ...validParams,
          size: -1,
        }),
      ).toThrow("Invalid size");
    });
  });

  describe("reconstruct()", () => {
    it("should reconstruct a persisted entity from database data", () => {
      const id = "test-uuid";
      const createdAt = Temporal.Now.instant();
      const updatedAt = Temporal.Now.instant();

      const metadata = StoredObjectMetadata.reconstruct({
        id,
        ...validParams,
        downloadCount: 5,
        createdAt,
        updatedAt,
      });

      expect(metadata.id).toBe(id);
      expect(metadata.objectKey.value).toBe("images/photo.png");
      expect(metadata.size).toBe(1024);
      expect(metadata.contentType.value).toBe("image/png");
      expect(metadata.etag.value).toBe('"abc123"');
      expect(metadata.downloadCount).toBe(5);
      expect(metadata.createdAt).toBe(createdAt);
      expect(metadata.updatedAt).toBe(updatedAt);
    });

    it("should throw an error for negative size on reconstruct", () => {
      expect(() =>
        StoredObjectMetadata.reconstruct({
          id: "test-uuid",
          ...validParams,
          size: -1,
          downloadCount: 0,
          createdAt: Temporal.Now.instant(),
          updatedAt: Temporal.Now.instant(),
        }),
      ).toThrow("Invalid size");
    });

    it("should throw an error for negative downloadCount", () => {
      expect(() =>
        StoredObjectMetadata.reconstruct({
          id: "test-uuid",
          ...validParams,
          downloadCount: -1,
          createdAt: Temporal.Now.instant(),
          updatedAt: Temporal.Now.instant(),
        }),
      ).toThrow("Invalid downloadCount");
    });
  });

  describe("equals()", () => {
    it("should return true for persisted entities with the same id", () => {
      const id = "test-uuid";
      const instant = Temporal.Now.instant();

      const metadata1 = StoredObjectMetadata.reconstruct({
        id,
        ...validParams,
        downloadCount: 0,
        createdAt: instant,
        updatedAt: instant,
      });
      const metadata2 = StoredObjectMetadata.reconstruct({
        id,
        objectKey: ObjectKey.create("docs/readme.md"),
        size: 2048,
        contentType: ContentType.create("text/markdown"),
        etag: ETag.create('"def456"'),
        downloadCount: 0,
        createdAt: instant,
        updatedAt: instant,
      });

      expect(metadata1.equals(metadata2)).toBe(true);
    });

    it("should return false for persisted entities with different ids", () => {
      const instant = Temporal.Now.instant();

      const metadata1 = StoredObjectMetadata.reconstruct({
        id: "uuid-1",
        ...validParams,
        downloadCount: 0,
        createdAt: instant,
        updatedAt: instant,
      });
      const metadata2 = StoredObjectMetadata.reconstruct({
        id: "uuid-2",
        ...validParams,
        downloadCount: 0,
        createdAt: instant,
        updatedAt: instant,
      });

      expect(metadata1.equals(metadata2)).toBe(false);
    });

    it("should return false for different unpersisted entities", () => {
      const metadata1 = StoredObjectMetadata.create(validParams);
      const metadata2 = StoredObjectMetadata.create(validParams);

      expect(metadata1.equals(metadata2)).toBe(false);
    });

    it("should return true for the same unpersisted entity reference", () => {
      const metadata = StoredObjectMetadata.create(validParams);

      expect(metadata.equals(metadata)).toBe(true);
    });
  });

  describe("toJSON()", () => {
    it("should convert persisted entity to plain object", () => {
      const id = "test-uuid";
      const createdAt = Temporal.Now.instant();
      const updatedAt = Temporal.Now.instant();

      const metadata = StoredObjectMetadata.reconstruct({
        id,
        ...validParams,
        downloadCount: 10,
        createdAt,
        updatedAt,
      });

      const json = metadata.toJSON();

      expect(json.id).toBe(id);
      expect(json.objectKey).toBe("images/photo.png");
      expect(json.size).toBe(1024);
      expect(json.contentType).toBe("image/png");
      expect(json.etag).toBe('"abc123"');
      expect(json.downloadCount).toBe(10);
      expect(json.createdAt).toBe(createdAt.toString());
      expect(json.updatedAt).toBe(updatedAt.toString());
    });

    it("should handle undefined fields in unpersisted entity", () => {
      const metadata = StoredObjectMetadata.create(validParams);

      const json = metadata.toJSON();

      expect(json.id).toBeUndefined();
      expect(json.objectKey).toBe("images/photo.png");
      expect(json.size).toBe(1024);
      expect(json.contentType).toBe("image/png");
      expect(json.etag).toBe('"abc123"');
      expect(json.downloadCount).toBe(0);
      expect(json.createdAt).toBeUndefined();
      expect(json.updatedAt).toBeUndefined();
    });
  });
});
