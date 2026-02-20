import { describe, expect, it } from "vitest";
import {
  InvalidImageUrlError,
  InvalidNoteSlugError,
  InvalidNoteTitleError,
  MarkdownNotFoundError,
  NoteMetadataValidationError,
  NoteNotFoundError,
  NoteParseError,
} from "./errors";

describe("NoteParseError", () => {
  it("ファイル名を含むエラーメッセージを生成する", () => {
    const error = new NoteParseError("my-article.md");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NoteParseError");
    expect(error.message).toContain("my-article.md");
    expect(error.fileName).toBe("my-article.md");
  });
});

describe("NoteMetadataValidationError", () => {
  it("欠落フィールド名とファイル名を含むエラーメッセージを生成する", () => {
    const error = new NoteMetadataValidationError("my-article.md", [
      "title",
      "imageUrl",
    ]);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NoteMetadataValidationError");
    expect(error.message).toContain("my-article.md");
    expect(error.message).toContain("title");
    expect(error.message).toContain("imageUrl");
    expect(error.fileName).toBe("my-article.md");
    expect(error.missingFields).toEqual(["title", "imageUrl"]);
  });
});

describe("InvalidNoteSlugError", () => {
  it("不正な値を含むエラーメッセージを生成する", () => {
    const error = new InvalidNoteSlugError("INVALID SLUG!");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InvalidNoteSlugError");
    expect(error.message).toContain("INVALID SLUG!");
    expect(error.value).toBe("INVALID SLUG!");
  });
});

describe("InvalidNoteTitleError", () => {
  it("不正な値を含むエラーメッセージを生成する", () => {
    const error = new InvalidNoteTitleError("");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InvalidNoteTitleError");
    expect(error.value).toBe("");
  });
});

describe("InvalidImageUrlError", () => {
  it("不正な値を含むエラーメッセージを生成する", () => {
    const error = new InvalidImageUrlError("not-a-url");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InvalidImageUrlError");
    expect(error.message).toContain("not-a-url");
    expect(error.value).toBe("not-a-url");
  });
});

describe("NoteNotFoundError", () => {
  it("slug を含むエラーメッセージを生成する", () => {
    const error = new NoteNotFoundError("my-article");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NoteNotFoundError");
    expect(error.message).toContain("my-article");
    expect(error.slug).toBe("my-article");
  });
});

describe("MarkdownNotFoundError", () => {
  it("slug を含むエラーメッセージを生成する", () => {
    const error = new MarkdownNotFoundError("my-article");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("MarkdownNotFoundError");
    expect(error.message).toContain("my-article");
    expect(error.slug).toBe("my-article");
  });
});
