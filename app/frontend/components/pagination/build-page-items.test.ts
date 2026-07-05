import { describe, expect, it } from "vitest";
import { buildPageItems } from "./build-page-items";

describe("buildPageItems", () => {
  it("lists every page without ellipsis when the range is small", () => {
    expect(buildPageItems(2, 4)).toEqual([
      { type: "page", page: 1 },
      { type: "page", page: 2 },
      { type: "page", page: 3 },
      { type: "page", page: 4 },
    ]);
  });

  it("inserts an ellipsis on the right when far from the end", () => {
    expect(buildPageItems(2, 10)).toEqual([
      { type: "page", page: 1 },
      { type: "page", page: 2 },
      { type: "page", page: 3 },
      { type: "ellipsis", after: 3 },
      { type: "page", page: 10 },
    ]);
  });

  it("inserts ellipses on both sides in the middle", () => {
    expect(buildPageItems(6, 12)).toEqual([
      { type: "page", page: 1 },
      { type: "ellipsis", after: 1 },
      { type: "page", page: 5 },
      { type: "page", page: 6 },
      { type: "page", page: 7 },
      { type: "ellipsis", after: 7 },
      { type: "page", page: 12 },
    ]);
  });

  it("gives ellipses distinct keys via their `after` page", () => {
    const items = buildPageItems(6, 12).filter(
      (item) => item.type === "ellipsis",
    );
    const keys = items.map((item) => item.after);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
