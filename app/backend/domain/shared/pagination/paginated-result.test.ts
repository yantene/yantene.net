import { describe, expect, it } from "vitest";
import type { PaginatedResult, PaginationMeta } from "./paginated-result";

describe("PaginatedResult 型", () => {
  it("items 配列と pagination メタデータを持つオブジェクトを構築できる", () => {
    const meta: PaginationMeta = {
      page: 1,
      perPage: 20,
      totalCount: 50,
      totalPages: 3,
    };

    const result: PaginatedResult<string> = {
      items: ["a", "b", "c"],
      pagination: meta,
    };

    expect(result.items).toEqual(["a", "b", "c"]);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.perPage).toBe(20);
    expect(result.pagination.totalCount).toBe(50);
    expect(result.pagination.totalPages).toBe(3);
  });

  it("ジェネリクスで任意の型に対応できる", () => {
    type TestEntity = { readonly id: number; readonly name: string };

    const result: PaginatedResult<TestEntity> = {
      items: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
      pagination: {
        page: 1,
        perPage: 10,
        totalCount: 2,
        totalPages: 1,
      },
    };

    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe("Alice");
  });

  it("items が空配列でも構築できる", () => {
    const result: PaginatedResult<number> = {
      items: [],
      pagination: {
        page: 5,
        perPage: 20,
        totalCount: 80,
        totalPages: 4,
      },
    };

    expect(result.items).toHaveLength(0);
    expect(result.pagination.page).toBe(5);
    expect(result.pagination.totalCount).toBe(80);
  });
});
