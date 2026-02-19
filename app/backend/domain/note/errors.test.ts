import { describe, expect, it } from "vitest";
import { NoteMetadataValidationError, NoteParseError } from "./errors";

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
