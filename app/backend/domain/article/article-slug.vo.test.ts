import { describe, expect, it } from "vitest";
import { InvalidArticleSlugError, ArticleSlug } from "./article-slug.vo";

describe("ArticleSlug", () => {
  it("accepts lowercase alphanumerics with single hyphens", () => {
    expect(ArticleSlug.create("hello-world-2026").toString()).toBe("hello-world-2026");
  });

  it("trims and lowercases input", () => {
    expect(ArticleSlug.create("  Hello-World  ").toString()).toBe("hello-world");
  });

  it("rejects empty input", () => {
    expect(() => ArticleSlug.create(" ".repeat(3))).toThrow(InvalidArticleSlugError);
  });

  it("rejects leading, trailing, and doubled hyphens", () => {
    expect(() => ArticleSlug.create("-hello")).toThrow(InvalidArticleSlugError);
    expect(() => ArticleSlug.create("hello-")).toThrow(InvalidArticleSlugError);
    expect(() => ArticleSlug.create("hello--world")).toThrow(InvalidArticleSlugError);
  });

  it("rejects characters outside [a-z0-9-]", () => {
    expect(() => ArticleSlug.create("hello_world")).toThrow(InvalidArticleSlugError);
    expect(() => ArticleSlug.create("hello world")).toThrow(InvalidArticleSlugError);
    expect(() => ArticleSlug.create("こんにちは")).toThrow(InvalidArticleSlugError);
  });

  it("rejects slugs longer than 200 characters", () => {
    expect(() => ArticleSlug.create("a".repeat(201))).toThrow(InvalidArticleSlugError);
  });

  it("compares by value with equals", () => {
    expect(ArticleSlug.create("foo").equals(ArticleSlug.create("foo"))).toBe(true);
    expect(ArticleSlug.create("foo").equals(ArticleSlug.create("bar"))).toBe(false);
  });

  it("serializes to a plain string via toJSON", () => {
    expect(ArticleSlug.create("foo-bar").toJSON()).toBe("foo-bar");
  });

  describe("parse", () => {
    it("読めればスラグを返す", () => {
      expect(ArticleSlug.parse("foo-bar")?.toString()).toBe("foo-bar");
    });

    it.each(["", "-foo", "foo-", "foo--bar", "こんにちは", "a".repeat(201)])(
      "読めなければ undefined (%s)",
      (raw) => {
        expect(ArticleSlug.parse(raw)).toBeUndefined();
      },
    );

    /* create が均す分はここでも均る。大文字で来た URL は 404 にせず拾う。 */
    it("大文字や前後の空白は均して読む", () => {
      expect(ArticleSlug.parse(" Foo-Bar ")?.toString()).toBe("foo-bar");
    });

    /*
     * 握るのはスラグとして読めなかったときだけ。一緒に握ると、想定外の失敗が
     * 「そんな記事は無い」の顔をして静かに通る。同じ処理が 5 か所に写されていた頃、
     * 1 か所だけ catch {} で全部を握っていた (#291)。
     */
    it("スラグ以外の失敗は握らずに投げる", () => {
      const boom = new TypeError("想定外");
      const create = ArticleSlug.create;
      // create が別の失敗を出す状況を作る。ここが握られると気づけない。
      ArticleSlug.create = () => {
        throw boom;
      };
      try {
        expect(() => ArticleSlug.parse("foo")).toThrow(boom);
      } finally {
        ArticleSlug.create = create;
      }
    });
  });
});
