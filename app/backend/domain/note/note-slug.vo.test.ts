import { describe, expect, it } from "vitest";
import { InvalidNoteSlugError, NoteSlug } from "./note-slug.vo";

describe("NoteSlug", () => {
  it("accepts lowercase alphanumerics with single hyphens", () => {
    expect(NoteSlug.create("hello-world-2026").toString()).toBe("hello-world-2026");
  });

  it("trims and lowercases input", () => {
    expect(NoteSlug.create("  Hello-World  ").toString()).toBe("hello-world");
  });

  it("rejects empty input", () => {
    expect(() => NoteSlug.create(" ".repeat(3))).toThrow(InvalidNoteSlugError);
  });

  it("rejects leading, trailing, and doubled hyphens", () => {
    expect(() => NoteSlug.create("-hello")).toThrow(InvalidNoteSlugError);
    expect(() => NoteSlug.create("hello-")).toThrow(InvalidNoteSlugError);
    expect(() => NoteSlug.create("hello--world")).toThrow(InvalidNoteSlugError);
  });

  it("rejects characters outside [a-z0-9-]", () => {
    expect(() => NoteSlug.create("hello_world")).toThrow(InvalidNoteSlugError);
    expect(() => NoteSlug.create("hello world")).toThrow(InvalidNoteSlugError);
    expect(() => NoteSlug.create("こんにちは")).toThrow(InvalidNoteSlugError);
  });

  it("rejects slugs longer than 200 characters", () => {
    expect(() => NoteSlug.create("a".repeat(201))).toThrow(InvalidNoteSlugError);
  });

  it("compares by value with equals", () => {
    expect(NoteSlug.create("foo").equals(NoteSlug.create("foo"))).toBe(true);
    expect(NoteSlug.create("foo").equals(NoteSlug.create("bar"))).toBe(false);
  });

  it("serializes to a plain string via toJSON", () => {
    expect(NoteSlug.create("foo-bar").toJSON()).toBe("foo-bar");
  });

  describe("parse", () => {
    it("読めればスラグを返す", () => {
      expect(NoteSlug.parse("foo-bar")?.toString()).toBe("foo-bar");
    });

    it.each(["", "-foo", "foo-", "foo--bar", "こんにちは", "a".repeat(201)])(
      "読めなければ undefined (%s)",
      (raw) => {
        expect(NoteSlug.parse(raw)).toBeUndefined();
      },
    );

    /* create が均す分はここでも均る。大文字で来た URL は 404 にせず拾う。 */
    it("大文字や前後の空白は均して読む", () => {
      expect(NoteSlug.parse(" Foo-Bar ")?.toString()).toBe("foo-bar");
    });

    /*
     * 握るのはスラグとして読めなかったときだけ。一緒に握ると、想定外の失敗が
     * 「そんな記事は無い」の顔をして静かに通る。同じ処理が 5 か所に写されていた頃、
     * 1 か所だけ catch {} で全部を握っていた (#291)。
     */
    it("スラグ以外の失敗は握らずに投げる", () => {
      const boom = new TypeError("想定外");
      const create = NoteSlug.create;
      // create が別の失敗を出す状況を作る。ここが握られると気づけない。
      NoteSlug.create = () => {
        throw boom;
      };
      try {
        expect(() => NoteSlug.parse("foo")).toThrow(boom);
      } finally {
        NoteSlug.create = create;
      }
    });
  });
});
