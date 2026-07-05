import { describe, expect, it } from "vitest";
import { InvalidNoteSlugError, NoteSlug } from "./note-slug.vo";

describe("NoteSlug", () => {
  it("accepts lowercase alphanumerics with single hyphens", () => {
    expect(NoteSlug.create("hello-world-2026").toString()).toBe(
      "hello-world-2026",
    );
  });

  it("trims and lowercases input", () => {
    expect(NoteSlug.create("  Hello-World  ").toString()).toBe("hello-world");
  });

  it("rejects empty input", () => {
    expect(() => NoteSlug.create(" ".repeat(3))).toThrow(InvalidNoteSlugError);
  });

  it("rejects leading, trailing, and doubled hyphens", () => {
    expect(() => NoteSlug.create("-hello")).toThrow(InvalidNoteSlugError);
    expect(() => NoteSlug.create("hello-")).toThrow(InvalidNoteSlugError);
    expect(() => NoteSlug.create("hello--world")).toThrow(InvalidNoteSlugError);
  });

  it("rejects characters outside [a-z0-9-]", () => {
    expect(() => NoteSlug.create("hello_world")).toThrow(InvalidNoteSlugError);
    expect(() => NoteSlug.create("hello world")).toThrow(InvalidNoteSlugError);
    expect(() => NoteSlug.create("こんにちは")).toThrow(InvalidNoteSlugError);
  });

  it("rejects slugs longer than 200 characters", () => {
    expect(() => NoteSlug.create("a".repeat(201))).toThrow(
      InvalidNoteSlugError,
    );
  });

  it("compares by value with equals", () => {
    expect(NoteSlug.create("foo").equals(NoteSlug.create("foo"))).toBe(true);
    expect(NoteSlug.create("foo").equals(NoteSlug.create("bar"))).toBe(false);
  });

  it("serializes to a plain string via toJSON", () => {
    expect(NoteSlug.create("foo-bar").toJSON()).toBe("foo-bar");
  });
});
