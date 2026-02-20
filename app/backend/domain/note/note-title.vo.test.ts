import { describe, expect, it } from "vitest";
import { InvalidNoteTitleError } from "./errors";
import { NoteTitle } from "./note-title.vo";

describe("NoteTitle Value Object", () => {
  describe("create()", () => {
    it("should create a NoteTitle with a valid value", () => {
      const title = NoteTitle.create("My First Article");

      expect(title.value).toBe("My First Article");
    });

    it("should create a NoteTitle with a single character", () => {
      const title = NoteTitle.create("A");

      expect(title.value).toBe("A");
    });

    it("should create a NoteTitle with unicode characters", () => {
      const title = NoteTitle.create("日本語のタイトル");

      expect(title.value).toBe("日本語のタイトル");
    });

    it("should throw an error for an empty string", () => {
      expect(() => NoteTitle.create("")).toThrow(InvalidNoteTitleError);
    });
  });

  describe("equals()", () => {
    it("should return true for NoteTitles with the same value", () => {
      const title1 = NoteTitle.create("Same Title");
      const title2 = NoteTitle.create("Same Title");

      expect(title1.equals(title2)).toBe(true);
    });

    it("should return false for NoteTitles with different values", () => {
      const title1 = NoteTitle.create("Title A");
      const title2 = NoteTitle.create("Title B");

      expect(title1.equals(title2)).toBe(false);
    });
  });

  describe("toJSON()", () => {
    it("should return the string value", () => {
      const title = NoteTitle.create("My Article Title");

      expect(title.toJSON()).toBe("My Article Title");
    });
  });
});
