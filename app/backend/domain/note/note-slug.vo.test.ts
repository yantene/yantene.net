import { describe, expect, it } from "vitest";
import { NoteSlug } from "./note-slug.vo";

describe("NoteSlug Value Object", () => {
  describe("create()", () => {
    it("should create a NoteSlug with a valid slug", () => {
      const slug = NoteSlug.create("hello-world");

      expect(slug.value).toBe("hello-world");
    });

    it("should create a NoteSlug with a single word", () => {
      const slug = NoteSlug.create("hello");

      expect(slug.value).toBe("hello");
    });

    it("should create a NoteSlug with numbers", () => {
      const slug = NoteSlug.create("post123");

      expect(slug.value).toBe("post123");
    });

    it("should create a NoteSlug with numbers and hyphens", () => {
      const slug = NoteSlug.create("my-2nd-post");

      expect(slug.value).toBe("my-2nd-post");
    });

    it("should create a NoteSlug with only numbers", () => {
      const slug = NoteSlug.create("123");

      expect(slug.value).toBe("123");
    });

    it("should throw an error for an empty string", () => {
      expect(() => NoteSlug.create("")).toThrow("Invalid note slug: ");
    });

    it("should throw an error for a string with uppercase letters", () => {
      expect(() => NoteSlug.create("Hello-World")).toThrow(
        "Invalid note slug: Hello-World",
      );
    });

    it("should throw an error for a string with spaces", () => {
      expect(() => NoteSlug.create("hello world")).toThrow(
        "Invalid note slug: hello world",
      );
    });

    it("should throw an error for a string starting with a hyphen", () => {
      expect(() => NoteSlug.create("-hello")).toThrow(
        "Invalid note slug: -hello",
      );
    });

    it("should throw an error for a string ending with a hyphen", () => {
      expect(() => NoteSlug.create("hello-")).toThrow(
        "Invalid note slug: hello-",
      );
    });

    it("should throw an error for a string with consecutive hyphens", () => {
      expect(() => NoteSlug.create("hello--world")).toThrow(
        "Invalid note slug: hello--world",
      );
    });

    it("should throw an error for a string with special characters", () => {
      expect(() => NoteSlug.create("hello@world")).toThrow(
        "Invalid note slug: hello@world",
      );
    });

    it("should throw an error for a string with underscores", () => {
      expect(() => NoteSlug.create("hello_world")).toThrow(
        "Invalid note slug: hello_world",
      );
    });

    it("should throw an error for a string with dots", () => {
      expect(() => NoteSlug.create("hello.world")).toThrow(
        "Invalid note slug: hello.world",
      );
    });

    it("should throw an error for a string with slashes", () => {
      expect(() => NoteSlug.create("hello/world")).toThrow(
        "Invalid note slug: hello/world",
      );
    });
  });

  describe("equals()", () => {
    it("should return true for NoteSlugs with the same value", () => {
      const slug1 = NoteSlug.create("hello-world");
      const slug2 = NoteSlug.create("hello-world");

      expect(slug1.equals(slug2)).toBe(true);
    });

    it("should return false for NoteSlugs with different values", () => {
      const slug1 = NoteSlug.create("hello-world");
      const slug2 = NoteSlug.create("goodbye-world");

      expect(slug1.equals(slug2)).toBe(false);
    });
  });

  describe("toJSON()", () => {
    it("should return the string value", () => {
      const slug = NoteSlug.create("hello-world");

      expect(slug.toJSON()).toBe("hello-world");
    });
  });
});
