import { describe, expect, it } from "vitest";
import { InvalidArticleTitleError, ArticleTitle } from "./article-title.vo";

describe("ArticleTitle", () => {
  it("keeps the original casing and symbols", () => {
    expect(ArticleTitle.create("Hello, World! 記事").toString()).toBe("Hello, World! 記事");
  });

  it("trims surrounding whitespace", () => {
    expect(ArticleTitle.create("  Title  ").toString()).toBe("Title");
  });

  it("rejects empty or whitespace-only input", () => {
    expect(() => ArticleTitle.create("")).toThrow(InvalidArticleTitleError);
    expect(() => ArticleTitle.create(" ".repeat(3))).toThrow(InvalidArticleTitleError);
  });

  it("rejects titles longer than 200 characters", () => {
    expect(() => ArticleTitle.create("あ".repeat(201))).toThrow(InvalidArticleTitleError);
  });

  it("compares by value with equals", () => {
    expect(ArticleTitle.create("A").equals(ArticleTitle.create("A"))).toBe(true);
    expect(ArticleTitle.create("A").equals(ArticleTitle.create("B"))).toBe(false);
  });

  it("serializes to a plain string via toJSON", () => {
    expect(ArticleTitle.create("Title").toJSON()).toBe("Title");
  });
});
