import { describe, expect, it } from "vitest";
import { InvalidWorkSlugError, WorkSlug } from "./work-slug.vo";

describe("WorkSlug", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(WorkSlug.create("  Infoholick  ").toString()).toBe("infoholick");
  });

  it.each([
    ["空", ""],
    ["ハイフン始まり", "-x"],
    ["ハイフン終わり", "x-"],
    ["ハイフンの連続", "a--b"],
    ["スラッシュ", "a/b"],
    ["日本語", "作品"],
  ])("%s は弾く", (_label, raw) => {
    expect(() => WorkSlug.create(raw)).toThrow(InvalidWorkSlugError);
  });

  it("rejects a slug longer than 200 characters", () => {
    expect(() => WorkSlug.create("a".repeat(201))).toThrow(InvalidWorkSlugError);
  });

  /*
   * `parse` が握るのはスラグとして読めなかったときだけ。一緒に握ると、想定外の失敗が
   * 「そんな作品は無い」の顔をして静かに通る (記事側で起きたのが #291)。
   */
  it("parse returns undefined for an unreadable slug", () => {
    expect(WorkSlug.parse("a--b")).toBeUndefined();
    expect(WorkSlug.parse("infoholick")?.toString()).toBe("infoholick");
  });

  it("equals compares by value", () => {
    expect(WorkSlug.create("arerd").equals(WorkSlug.create("arerd"))).toBe(true);
    expect(WorkSlug.create("arerd").equals(WorkSlug.create("infoholick"))).toBe(false);
  });
});
