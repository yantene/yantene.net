/* eslint-disable security/detect-non-literal-fs-filename */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("D1 Migrations", () => {
  it("should have object_storage_file_metadata migration file", () => {
    const migrationPath = path.join(
      __dirname,
      "0001_create_object_storage_file_metadata.sql",
    );
    const content = readFileSync(migrationPath, "utf8");

    expect(content).toContain("CREATE TABLE `object_storage_file_metadata`");
    expect(content).toContain("`id` text PRIMARY KEY NOT NULL");
    expect(content).toContain("`object_key` text NOT NULL");
    expect(content).toContain("`size` integer NOT NULL");
    expect(content).toContain("`content_type` text NOT NULL");
    expect(content).toContain("`etag` text NOT NULL");
    expect(content).toContain(
      "`created_at` real DEFAULT (unixepoch('subsec')) NOT NULL",
    );
    expect(content).toContain(
      "`updated_at` real DEFAULT (unixepoch('subsec')) NOT NULL",
    );
    expect(content).toContain("CREATE UNIQUE INDEX");
    expect(content).toContain("`object_key`");
  });

  it("should have file_download_counts migration file", () => {
    const migrationPath = path.join(
      __dirname,
      "0002_create_file_download_counts.sql",
    );
    const content = readFileSync(migrationPath, "utf8");

    expect(content).toContain("CREATE TABLE `file_download_counts`");
    expect(content).toContain("`object_key` text PRIMARY KEY NOT NULL");
    expect(content).toContain("`count` integer DEFAULT 0 NOT NULL");
    expect(content).toContain(
      "FOREIGN KEY (`object_key`) REFERENCES `object_storage_file_metadata`",
    );
  });

  it("should have valid SQL syntax for object_storage_file_metadata", () => {
    const migrationPath = path.join(
      __dirname,
      "0001_create_object_storage_file_metadata.sql",
    );
    const content = readFileSync(migrationPath, "utf8");

    // Basic SQL syntax validation
    expect(content).toMatch(/CREATE TABLE/);
    expect(content).toMatch(/\);/);
  });

  it("should have valid SQL syntax for file_download_counts", () => {
    const migrationPath = path.join(
      __dirname,
      "0002_create_file_download_counts.sql",
    );
    const content = readFileSync(migrationPath, "utf8");

    // Basic SQL syntax validation
    expect(content).toMatch(/CREATE TABLE/);
    expect(content).toMatch(/\);/);
  });
});
