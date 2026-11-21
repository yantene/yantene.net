import { describe, expect, it } from "vitest";
import { sampleSlideContext } from "./slide-fixture";
import {
  FIRST_POSITION,
  crossesChapter,
  goTo,
  hashOf,
  next,
  positionFromHash,
  previous,
  targetForKey,
} from "./slide-navigation";

/*
 * 見本のデッキの並び (0 始まり):
 * 0 表紙 / 1 章「動機」/ 2 列挙 / 3 一言 / 4 章「構成」/ 5 図 / 6 段のあるページ (最後の段 3)
 * / 7 表 / 8 引用 / 9 コード / 10 数式 / 11 図式 / 12 入れ子の列挙 / 13 一言 / 14 参考
 */
const { deck } = sampleSlideContext();
const STEPPED = 6;

describe("next / previous", () => {
  it("moves to the next page when the page has no steps left", () => {
    expect(next(deck, FIRST_POSITION)).toEqual({ page: 1, step: 0 });
  });

  it("reveals the steps of a page before leaving it", () => {
    const steps = [0, 1, 2, 3].map((step) => next(deck, { page: STEPPED, step }));
    expect(steps).toEqual([
      { page: STEPPED, step: 1 },
      { page: STEPPED, step: 2 },
      { page: STEPPED, step: 3 },
      { page: STEPPED + 1, step: 0 },
    ]);
  });

  it("stays put at the very end and at the very start", () => {
    const end = { page: deck.pages.length - 1, step: 0 };
    expect(next(deck, end)).toEqual(end);
    expect(previous(deck, FIRST_POSITION)).toEqual(FIRST_POSITION);
  });

  /*
   * 前のページへ戻ったら、そのページを全部出した姿にする。戻った先で段を出し直させると、
   * 読み返したいだけの人が何度も送ることになる。
   */
  it("lands on a fully revealed page when going back", () => {
    expect(previous(deck, { page: STEPPED + 1, step: 0 })).toEqual({ page: STEPPED, step: 3 });
    expect(previous(deck, { page: STEPPED, step: 3 })).toEqual({ page: STEPPED, step: 2 });
  });
});

describe("goTo / ハッシュ", () => {
  it("clamps a page outside the deck to the nearest end", () => {
    expect(goTo(deck, -3)).toEqual({ page: 0, step: 0 });
    expect(goTo(deck, 999)).toEqual({ page: deck.pages.length - 1, step: 0 });
  });

  /* ハッシュのページは 1 始まり (`#1` が表紙)。 */
  it("reads and writes the page as a 1-based hash", () => {
    expect(positionFromHash(deck, "#3")).toEqual({ page: 2, step: 0 });
    expect(hashOf({ page: 2, step: 1 })).toBe("#3");
  });

  /* 見出しへのリンクなど、ページ番号でないハッシュには反応しない。 */
  it.each(["", "#", "#intro", "#3a", "#user-content-fn-1", "#-1"])("ignores %j", (hash) => {
    expect(positionFromHash(deck, hash)).toBeUndefined();
  });
});

describe("crossesChapter", () => {
  it("is true only when the chapter changes", () => {
    const at = (page: number): { page: number; step: number } => ({ page, step: 0 });

    expect(crossesChapter(deck, at(2), at(3))).toBe(false);
    expect(crossesChapter(deck, at(3), at(4))).toBe(true);
    // 表紙から最初の章へも、章をまたぐ。
    expect(crossesChapter(deck, at(0), at(1))).toBe(true);
  });
});

describe("targetForKey", () => {
  const at = { page: 2, step: 0 };

  /* 左右の矢印は、ページの上で他の働きを持たない。いつでも送る。 */
  it("always moves on the horizontal arrows", () => {
    expect(targetForKey(deck, at, "ArrowRight", false)).toEqual({ page: 3, step: 0 });
    expect(targetForKey(deck, at, "ArrowLeft", false)).toEqual({ page: 1, step: 0 });
  });

  /*
   * Space・PageDown・上下の矢印・Home / End はページのスクロールにも使う。読み手が
   * スライドに向き合っていない間は取らない (下の読み物へキーボードで降りられなくなる)。
   */
  it.each([" ", "Enter", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End", "Backspace"])(
    "leaves %j to the browser until the reader engages with the deck",
    (key) => {
      expect(targetForKey(deck, at, key, false)).toBeUndefined();
      expect(targetForKey(deck, at, key, true)).toBeDefined();
    },
  );

  /* 発表用のリモコンは PageDown / PageUp を送る。 */
  it("moves on the keys a presentation remote sends", () => {
    expect(targetForKey(deck, at, "PageDown", true)).toEqual({ page: 3, step: 0 });
    expect(targetForKey(deck, at, "PageUp", true)).toEqual({ page: 1, step: 0 });
    expect(targetForKey(deck, at, "End", true)).toEqual({ page: deck.pages.length - 1, step: 0 });
    expect(targetForKey(deck, at, "Home", true)).toEqual({ page: 0, step: 0 });
  });

  it("ignores keys that mean nothing here", () => {
    expect(targetForKey(deck, at, "a", true)).toBeUndefined();
    expect(targetForKey(deck, at, "Escape", true)).toBeUndefined();
  });
});
