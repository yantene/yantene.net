import { describe, expect, it } from "vitest";
import { InvalidSlideSlugError, SlideSlug } from "./slide-slug.vo";

describe("SlideSlug", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(SlideSlug.create("  Semantic-Slides  ").toString()).toBe("semantic-slides");
  });

  it.each([
    ["空", ""],
    ["ハイフン始まり", "-x"],
    ["ハイフン終わり", "x-"],
    ["ハイフンの連続", "a--b"],
    ["スラッシュ", "a/b"],
    ["日本語", "発表"],
  ])("%s は弾く", (_label, raw) => {
    expect(() => SlideSlug.create(raw)).toThrow(InvalidSlideSlugError);
  });

  it("rejects a slug longer than 200 characters", () => {
    expect(() => SlideSlug.create("a".repeat(201))).toThrow(InvalidSlideSlugError);
  });

  /*
   * `parse` が握るのはスラグとして読めなかったときだけ。一緒に握ると、想定外の失敗が
   * 「そんなスライドは無い」の顔をして静かに通る (記事側で起きたのが #291)。
   */
  it("parse returns undefined for an unreadable slug", () => {
    expect(SlideSlug.parse("a--b")).toBeUndefined();
    expect(SlideSlug.parse("semantic-slides")?.toString()).toBe("semantic-slides");
  });

  it("equals compares by value", () => {
    expect(SlideSlug.create("lt-2026").equals(SlideSlug.create("lt-2026"))).toBe(true);
    expect(SlideSlug.create("lt-2026").equals(SlideSlug.create("semantic-slides"))).toBe(false);
  });
});
