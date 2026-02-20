import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoteSlug } from "../../../domain/note/note-slug.vo";
import { PaginationParams } from "../../../domain/shared/pagination/pagination-params.vo";
import { NoteQueryRepository } from "./note.query-repository";
import type { Note } from "../../../domain/note/note.entity";
import type { IPersisted } from "../../../domain/persisted.interface";
import type { DrizzleD1Database } from "drizzle-orm/d1";

type MockDb = DrizzleD1Database & {
  _mockAll: ReturnType<typeof vi.fn>;
  _mockGet: ReturnType<typeof vi.fn>;
  _mockWhere: ReturnType<typeof vi.fn>;
  _mockPaginatedAll: ReturnType<typeof vi.fn>;
  _mockCountGet: ReturnType<typeof vi.fn>;
  _mockOffset: ReturnType<typeof vi.fn>;
  _mockLimit: ReturnType<typeof vi.fn>;
};

function createMockDb(): MockDb {
  // findAll chain: select().from(notes).all()
  const mockAll = vi.fn();

  // findBySlug chain: select().from(notes).where(...).get()
  const mockGet = vi.fn();
  const mockWhere = vi.fn(() => ({ get: mockGet }));

  // findPaginated data chain: select().from(notes).orderBy(...).offset(...).limit(...).all()
  const mockPaginatedAll = vi.fn();
  const mockLimit = vi.fn(() => ({ all: mockPaginatedAll }));
  const mockOffset = vi.fn(() => ({ limit: mockLimit }));
  const mockOrderBy = vi.fn(() => ({ offset: mockOffset }));

  // findPaginated count chain: select({ count }).from(notes).get()
  const mockCountGet = vi.fn();

  // Use select argument to distinguish chains:
  // - select() with no args or column args -> data queries
  // - select({ count: ... }) -> count query
  const mockSelect = vi.fn((selectArg?: unknown) => {
    if (
      selectArg !== undefined &&
      typeof selectArg === "object" &&
      selectArg !== null &&
      "count" in selectArg
    ) {
      // Count query chain
      return {
        from: vi.fn(() => ({
          get: mockCountGet,
        })),
      };
    }
    // Data query chain
    return {
      from: vi.fn(() => ({
        all: mockAll,
        where: mockWhere,
        orderBy: mockOrderBy,
      })),
    };
  });

  return {
    select: mockSelect,
    _mockAll: mockAll,
    _mockGet: mockGet,
    _mockWhere: mockWhere,
    _mockPaginatedAll: mockPaginatedAll,
    _mockCountGet: mockCountGet,
    _mockOffset: mockOffset,
    _mockLimit: mockLimit,
  } as unknown as MockDb;
}

const testInstant = Temporal.Instant.from("2026-01-01T00:00:00Z");
const testPublishedOn = Temporal.PlainDate.from("2026-02-17");
const testLastModifiedOn = Temporal.PlainDate.from("2026-02-18");

const createDbRow = (
  overrides: Partial<{
    id: string;
    title: string;
    slug: string;
    publishedOn: Temporal.PlainDate;
  }> = {},
): {
  id: string;
  title: string;
  slug: string;
  etag: string;
  imageUrl: string;
  publishedOn: Temporal.PlainDate;
  lastModifiedOn: Temporal.PlainDate;
  createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
} => ({
  id: overrides.id ?? "test-id-1",
  title: overrides.title ?? "Test Title",
  slug: overrides.slug ?? "test-slug",
  etag: "test-etag",
  imageUrl: "https://example.com/image.png",
  publishedOn: overrides.publishedOn ?? testPublishedOn,
  lastModifiedOn: testLastModifiedOn,
  createdAt: testInstant,
  updatedAt: testInstant,
});

describe("NoteQueryRepository", () => {
  let db: MockDb;
  let repository: NoteQueryRepository;

  beforeEach(() => {
    db = createMockDb();
    repository = new NoteQueryRepository(db);
  });

  it("INoteQueryRepository を実装するクラスである", () => {
    expect(NoteQueryRepository).toBeDefined();
    expect(repository.findAll).toBeDefined();
    expect(repository.findBySlug).toBeDefined();
    expect(repository.findPaginated).toBeDefined();
  });

  describe("findAll()", () => {
    it("notes テーブルの全レコードを IPersisted 状態の Note 配列として返す", async () => {
      const row = createDbRow();
      db._mockAll.mockResolvedValue([row]);

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      const note = result[0];
      expect(note.id).toBe("test-id-1");
      expect(note.title.toJSON()).toBe("Test Title");
      expect(note.slug.toJSON()).toBe("test-slug");
      expect(note.etag.toJSON()).toBe("test-etag");
      expect(note.imageUrl.toJSON()).toBe("https://example.com/image.png");
      expect(note.publishedOn.toString()).toBe("2026-02-17");
      expect(note.lastModifiedOn.toString()).toBe("2026-02-18");
      expect(note.createdAt).toBe(testInstant);
      expect(note.updatedAt).toBe(testInstant);
    });

    it("複数レコードがある場合は全件を返す", async () => {
      const row1 = createDbRow();
      const row2 = createDbRow({
        id: "test-id-2",
        title: "Second Title",
        slug: "second-slug",
      });
      db._mockAll.mockResolvedValue([row1, row2]);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("test-id-1");
      expect(result[1].id).toBe("test-id-2");
    });

    it("レコードが存在しない場合は空配列を返す", async () => {
      db._mockAll.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe("findBySlug()", () => {
    it("一致する slug のレコードを IPersisted 状態の Note として返す", async () => {
      const row = createDbRow();
      db._mockGet.mockResolvedValue(row);

      const slug = NoteSlug.create("test-slug");
      const result = await repository.findBySlug(slug);

      expect(result).toBeDefined();
      const note = result as Note<IPersisted>;
      expect(note.id).toBe("test-id-1");
      expect(note.title.toJSON()).toBe("Test Title");
      expect(note.slug.toJSON()).toBe("test-slug");
      expect(note.etag.toJSON()).toBe("test-etag");
      expect(note.imageUrl.toJSON()).toBe("https://example.com/image.png");
      expect(note.publishedOn.toString()).toBe("2026-02-17");
      expect(note.lastModifiedOn.toString()).toBe("2026-02-18");
      expect(note.createdAt).toBe(testInstant);
      expect(note.updatedAt).toBe(testInstant);
    });

    it("一致する slug が存在しない場合は undefined を返す", async () => {
      db._mockGet.mockResolvedValue(null);

      const slug = NoteSlug.create("non-existent");
      const result = await repository.findBySlug(slug);

      expect(result).toBeUndefined();
    });
  });

  describe("findPaginated()", () => {
    it("PaginatedResult を正しい構造で返す", async () => {
      const row = createDbRow();
      db._mockCountGet.mockResolvedValue({ count: 1 });
      db._mockPaginatedAll.mockResolvedValue([row]);

      const params = PaginationParams.create({ page: "1", perPage: "10" });
      const result = await repository.findPaginated(params);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("test-id-1");
      expect(result.items[0].title.toJSON()).toBe("Test Title");
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.perPage).toBe(10);
      expect(result.pagination.totalCount).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it("totalPages を Math.ceil(totalCount / perPage) で計算する", async () => {
      db._mockCountGet.mockResolvedValue({ count: 25 });
      db._mockPaginatedAll.mockResolvedValue([createDbRow()]);

      const params = PaginationParams.create({ page: "1", perPage: "10" });
      const result = await repository.findPaginated(params);

      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.totalCount).toBe(25);
    });

    it("レコードが存在しない場合は空配列と totalCount: 0 を返す", async () => {
      db._mockCountGet.mockResolvedValue({ count: 0 });
      db._mockPaginatedAll.mockResolvedValue([]);

      const params = PaginationParams.create({ page: "1", perPage: "20" });
      const result = await repository.findPaginated(params);

      expect(result.items).toHaveLength(0);
      expect(result.pagination.totalCount).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it("offset と limit を PaginationParams から正しく適用する", async () => {
      db._mockCountGet.mockResolvedValue({ count: 50 });
      db._mockPaginatedAll.mockResolvedValue([]);

      const params = PaginationParams.create({ page: "3", perPage: "10" });
      await repository.findPaginated(params);

      expect(db._mockOffset).toHaveBeenCalledWith(20);
      expect(db._mockLimit).toHaveBeenCalledWith(10);
    });

    it("複数レコードを正しくエンティティに変換する", async () => {
      const row1 = createDbRow({
        id: "id-1",
        title: "Title 1",
        slug: "slug-1",
      });
      const row2 = createDbRow({
        id: "id-2",
        title: "Title 2",
        slug: "slug-2",
      });
      db._mockCountGet.mockResolvedValue({ count: 2 });
      db._mockPaginatedAll.mockResolvedValue([row1, row2]);

      const params = PaginationParams.create({ page: "1", perPage: "10" });
      const result = await repository.findPaginated(params);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe("id-1");
      expect(result.items[1].id).toBe("id-2");
    });
  });
});
