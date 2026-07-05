import { describe, expect, it } from "vitest";
import { ImageUrl, InvalidImageUrlError } from "./image-url.vo";

describe("ImageUrl", () => {
  it("accepts a root-relative asset API path", () => {
    const url = "/api/v1/notes/my-note/assets/cover.png";
    expect(ImageUrl.create(url).toString()).toBe(url);
  });

  it("trims surrounding whitespace", () => {
    expect(ImageUrl.create("  /a/b.png  ").toString()).toBe("/a/b.png");
  });

  it("rejects unresolved relative paths", () => {
    expect(() => ImageUrl.create("./cover.png")).toThrow(InvalidImageUrlError);
    expect(() => ImageUrl.create("cover.png")).toThrow(InvalidImageUrlError);
  });

  it("rejects absolute URLs, including raw Artifacts URLs", () => {
    // 絶対 URL は Artifacts の直接 URL 露出につながり、CSP (img-src 'self') でも
    // 表示できないため弾く。
    expect(() => ImageUrl.create("https://example.com/a.png")).toThrow(
      InvalidImageUrlError,
    );
    expect(() =>
      ImageUrl.create("https://artifacts.example/raw/notes/x/cover.png"),
    ).toThrow(InvalidImageUrlError);
  });

  it("rejects protocol-relative and non-http schemes", () => {
    expect(() => ImageUrl.create("//evil.com/a.png")).toThrow(
      InvalidImageUrlError,
    );
    expect(() => ImageUrl.create("javascript:alert(1)")).toThrow(
      InvalidImageUrlError,
    );
    expect(() => ImageUrl.create("data:image/png;base64,AAAA")).toThrow(
      InvalidImageUrlError,
    );
  });

  it("rejects empty input", () => {
    expect(() => ImageUrl.create(" ".repeat(3))).toThrow(InvalidImageUrlError);
  });

  it("compares by value with equals", () => {
    expect(ImageUrl.create("/a.png").equals(ImageUrl.create("/a.png"))).toBe(
      true,
    );
    expect(ImageUrl.create("/a.png").equals(ImageUrl.create("/b.png"))).toBe(
      false,
    );
  });
});
