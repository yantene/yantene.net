import { describe, expect, it } from "vitest";
import { fileDownloadCounts } from "./file-download-counts.table";

describe("fileDownloadCounts table schema", () => {
  it("should have correct table name", () => {
    expect(fileDownloadCounts).toBeDefined();
    // @ts-expect-error - Accessing internal property for testing
    expect(fileDownloadCounts[Symbol.for("drizzle:Name")]).toBe(
      "file_download_counts",
    );
  });

  it("should have all required columns", () => {
    const columns = Object.keys(fileDownloadCounts);
    expect(columns).toContain("objectKey");
    expect(columns).toContain("count");
  });

  it("should have objectKey as primary key", () => {
    expect(fileDownloadCounts.objectKey.primary).toBe(true);
    expect(fileDownloadCounts.objectKey.notNull).toBe(true);
  });

  it("should have count as not null integer with default 0", () => {
    expect(fileDownloadCounts.count.notNull).toBe(true);
    expect(fileDownloadCounts.count.hasDefault).toBe(true);
  });
});
