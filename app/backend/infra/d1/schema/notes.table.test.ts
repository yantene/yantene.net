import { describe, expect, it } from "vitest";
import { notes } from "./notes.table";

describe("notes table schema", () => {
  it("should have correct table name", () => {
    expect(notes).toBeDefined();
    // @ts-expect-error - Accessing internal property for testing
    expect(notes[Symbol.for("drizzle:Name")]).toBe("notes");
  });

  it("should have all required columns", () => {
    const columns = Object.keys(notes);
    expect(columns).toContain("id");
    expect(columns).toContain("title");
    expect(columns).toContain("slug");
    expect(columns).toContain("etag");
    expect(columns).toContain("imageUrl");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
  });

  it("should have id as primary key", () => {
    expect(notes.id.primary).toBe(true);
    expect(notes.id.notNull).toBe(true);
  });

  it("should have title as not null text", () => {
    expect(notes.title.notNull).toBe(true);
  });

  it("should have slug as not null text with unique constraint", () => {
    expect(notes.slug.notNull).toBe(true);
    expect(notes.slug.isUnique).toBe(true);
  });

  it("should have etag as not null text", () => {
    expect(notes.etag.notNull).toBe(true);
  });

  it("should have imageUrl as not null text", () => {
    expect(notes.imageUrl.notNull).toBe(true);
  });

  it("should have createdAt with default value", () => {
    expect(notes.createdAt.notNull).toBe(true);
    expect(notes.createdAt.hasDefault).toBe(true);
  });

  it("should have updatedAt with default value", () => {
    expect(notes.updatedAt.notNull).toBe(true);
    expect(notes.updatedAt.hasDefault).toBe(true);
  });
});
