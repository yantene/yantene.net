import { describe, expect, it } from "vitest";
import { parseNoteSort, parsePagination } from "./note-view";

describe("parsePagination", () => {
  it("defaults to page 1 and per-page 20", () => {
    expect(parsePagination(undefined, undefined)).toEqual({
      page: 1,
      perPage: 20,
      limit: 20,
      offset: 0,
    });
  });

  it("computes offset from page and per-page", () => {
    expect(parsePagination("3", "10")).toEqual({
      page: 3,
      perPage: 10,
      limit: 10,
      offset: 20,
    });
  });

  it("clamps per-page to the 1..100 range", () => {
    expect(parsePagination("1", "1000").perPage).toBe(100);
    // 範囲外 (0) は境界 (min 1) に丸める。非数値のみ既定 (20) に落ちる。
    expect(parsePagination("1", "0").perPage).toBe(1);
    expect(parsePagination("1", "x").perPage).toBe(20);
  });

  it("falls back to defaults on non-numeric or negative input", () => {
    expect(parsePagination("abc", "x")).toMatchObject({ page: 1, perPage: 20 });
    expect(parsePagination("-5", undefined).page).toBe(1);
  });

  it("treats empty / whitespace params as missing (uses defaults)", () => {
    expect(parsePagination("", "")).toMatchObject({ page: 1, perPage: 20 });
    expect(parsePagination("  ", " ")).toMatchObject({ page: 1, perPage: 20 });
  });
});

describe("parseNoteSort", () => {
  it("defaults to publishedOn descending", () => {
    expect(parseNoteSort(undefined, undefined)).toEqual({
      sortBy: "publishedOn",
      direction: "desc",
    });
  });

  it("maps 'modified' to lastModifiedOn and 'asc' to ascending", () => {
    expect(parseNoteSort("modified", "asc")).toEqual({
      sortBy: "lastModifiedOn",
      direction: "asc",
    });
  });

  it("treats unknown values as the safe defaults", () => {
    expect(parseNoteSort("bogus", "bogus")).toEqual({
      sortBy: "publishedOn",
      direction: "desc",
    });
  });
});
