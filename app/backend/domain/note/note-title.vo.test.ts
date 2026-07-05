import { describe, expect, it } from "vitest";
import { InvalidNoteTitleError, NoteTitle } from "./note-title.vo";

describe("NoteTitle", () => {
  it("keeps the original casing and symbols", () => {
    expect(NoteTitle.create("Hello, World! 記事").toString()).toBe(
      "Hello, World! 記事",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(NoteTitle.create("  Title  ").toString()).toBe("Title");
  });

  it("rejects empty or whitespace-only input", () => {
    expect(() => NoteTitle.create("")).toThrow(InvalidNoteTitleError);
    expect(() => NoteTitle.create(" ".repeat(3))).toThrow(
      InvalidNoteTitleError,
    );
  });

  it("rejects titles longer than 200 characters", () => {
    expect(() => NoteTitle.create("あ".repeat(201))).toThrow(
      InvalidNoteTitleError,
    );
  });

  it("compares by value with equals", () => {
    expect(NoteTitle.create("A").equals(NoteTitle.create("A"))).toBe(true);
    expect(NoteTitle.create("A").equals(NoteTitle.create("B"))).toBe(false);
  });

  it("serializes to a plain string via toJSON", () => {
    expect(NoteTitle.create("Title").toJSON()).toBe("Title");
  });
});
