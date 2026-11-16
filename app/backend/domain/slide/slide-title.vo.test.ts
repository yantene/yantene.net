import { describe, expect, it } from "vitest";
import { InvalidSlideTitleError, SlideTitle } from "./slide-title.vo";

describe("SlideTitle", () => {
  it("trims surrounding whitespace", () => {
    expect(SlideTitle.create("  意味だけで書くスライド  ").toString()).toBe(
      "意味だけで書くスライド",
    );
  });

  it.each([
    ["空", ""],
    ["空白だけ", "   "],
    ["201 文字", "あ".repeat(201)],
  ])("%s は弾く", (_label, raw) => {
    expect(() => SlideTitle.create(raw)).toThrow(InvalidSlideTitleError);
  });

  it("equals compares by value and toJSON returns the text", () => {
    expect(SlideTitle.create("題").equals(SlideTitle.create("題"))).toBe(true);
    expect(SlideTitle.create("題").equals(SlideTitle.create("別の題"))).toBe(false);
    expect(SlideTitle.create("題").toJSON()).toBe("題");
  });
});
