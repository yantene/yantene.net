import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoteSlug } from "../../../domain/note/note-slug.vo";
import { NoteQueryRepository } from "./note.query-repository";
import type { Note } from "../../../domain/note/note.entity";
import type { IPersisted } from "../../../domain/persisted.interface";
import type { DrizzleD1Database } from "drizzle-orm/d1";

function createMockDb(): DrizzleD1Database & {
  _mockAll: ReturnType<typeof vi.fn>;
  _mockGet: ReturnType<typeof vi.fn>;
  _mockWhere: ReturnType<typeof vi.fn>;
} {
  const mockAll = vi.fn();
  const mockGet = vi.fn();
  const mockWhere = vi.fn(() => ({ get: mockGet }));
  const mockFrom = vi.fn(() => ({ all: mockAll, where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  return {
    select: mockSelect,
    _mockAll: mockAll,
    _mockGet: mockGet,
    _mockWhere: mockWhere,
  } as unknown as DrizzleD1Database & {
    _mockAll: ReturnType<typeof vi.fn>;
    _mockGet: ReturnType<typeof vi.fn>;
    _mockWhere: ReturnType<typeof vi.fn>;
  };
}

const testInstant = Temporal.Instant.from("2026-01-01T00:00:00Z");
const testPublishedOn = Temporal.PlainDate.from("2026-02-17");
const testLastModifiedOn = Temporal.PlainDate.from("2026-02-18");

const createDbRow = (): {
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
  id: "test-id-1",
  title: "Test Title",
  slug: "test-slug",
  etag: "test-etag",
  imageUrl: "https://example.com/image.png",
  publishedOn: testPublishedOn,
  lastModifiedOn: testLastModifiedOn,
  createdAt: testInstant,
  updatedAt: testInstant,
});

describe("NoteQueryRepository", () => {
  let db: ReturnType<typeof createMockDb>;
  let repository: NoteQueryRepository;

  beforeEach(() => {
    db = createMockDb();
    repository = new NoteQueryRepository(db);
  });

  it("INoteQueryRepository を実装するクラスである", () => {
    expect(NoteQueryRepository).toBeDefined();
    expect(repository.findAll).toBeDefined();
    expect(repository.findBySlug).toBeDefined();
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
      const row2 = {
        ...createDbRow(),
        id: "test-id-2",
        title: "Second Title",
        slug: "second-slug",
      };
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
});
