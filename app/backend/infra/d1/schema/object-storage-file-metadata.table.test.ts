import { describe, expect, it } from "vitest";
import { objectStorageFileMetadata } from "./object-storage-file-metadata.table";

describe("objectStorageFileMetadata table schema", () => {
  it("should have correct table name", () => {
    expect(objectStorageFileMetadata).toBeDefined();
    // @ts-expect-error - Accessing internal property for testing
    expect(objectStorageFileMetadata[Symbol.for("drizzle:Name")]).toBe(
      "object_storage_file_metadata",
    );
  });

  it("should have all required columns", () => {
    const columns = Object.keys(objectStorageFileMetadata);
    expect(columns).toContain("id");
    expect(columns).toContain("objectKey");
    expect(columns).toContain("size");
    expect(columns).toContain("contentType");
    expect(columns).toContain("etag");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
  });

  it("should have id as primary key", () => {
    expect(objectStorageFileMetadata.id.primary).toBe(true);
    expect(objectStorageFileMetadata.id.notNull).toBe(true);
  });

  it("should have objectKey as not null", () => {
    expect(objectStorageFileMetadata.objectKey.notNull).toBe(true);
  });

  it("should have size as not null integer", () => {
    expect(objectStorageFileMetadata.size.notNull).toBe(true);
  });

  it("should have contentType as not null text", () => {
    expect(objectStorageFileMetadata.contentType.notNull).toBe(true);
  });

  it("should have etag as not null text", () => {
    expect(objectStorageFileMetadata.etag.notNull).toBe(true);
  });

  it("should have createdAt with default value", () => {
    expect(objectStorageFileMetadata.createdAt.notNull).toBe(true);
    expect(objectStorageFileMetadata.createdAt.hasDefault).toBe(true);
  });

  it("should have updatedAt with default value", () => {
    expect(objectStorageFileMetadata.updatedAt.notNull).toBe(true);
    expect(objectStorageFileMetadata.updatedAt.hasDefault).toBe(true);
  });
});
