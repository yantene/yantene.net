import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { ContentType } from "../../domain/shared/content-type.vo";
import { ETag } from "../../domain/shared/etag.vo";
import { ObjectKey } from "../../domain/shared/object-key.vo";
import { StoredObjectMetadata } from "./stored-object-metadata";

describe("StoredObjectMetadata", () => {
  const validParams = {
    objectKey: ObjectKey.create("images/photo.png"),
    size: 1024,
    contentType: ContentType.create("image/png"),
    etag: ETag.create('"abc123"'),
  };

  describe("create()", () => {
    it("should create metadata with valid params", () => {
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

    it("should create metadata with size 0", () => {
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
    it("should reconstruct metadata from database data", () => {
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
});
