import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageUrl } from "../../../domain/note/image-url.vo";
import { NoteSlug } from "../../../domain/note/note-slug.vo";
import { NoteTitle } from "../../../domain/note/note-title.vo";
import { Note } from "../../../domain/note/note.entity";
import { ETag } from "../../../domain/shared/etag.vo";
import { NoteCommandRepository } from "./note.command-repository";
import type { INoteQueryRepository } from "../../../domain/note/note.query-repository.interface";
import type { IPersisted } from "../../../domain/persisted.interface";
import type { DrizzleD1Database } from "drizzle-orm/d1";

const testInstant = Temporal.Instant.from("2026-01-01T00:00:00Z");
const testPublishedOn = Temporal.PlainDate.from("2026-02-17");
const testLastModifiedOn = Temporal.PlainDate.from("2026-02-18");

function createMockDb(): DrizzleD1Database & {
  _mockValues: ReturnType<typeof vi.fn>;
  _mockRun: ReturnType<typeof vi.fn>;
  _mockWhere: ReturnType<typeof vi.fn>;
} {
  const mockRun = vi.fn();
  const mockValues = vi.fn(() => ({ run: mockRun }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  const mockWhere = vi.fn(() => ({ run: mockRun }));
  const mockDelete = vi.fn(() => ({ where: mockWhere }));

  return {
    insert: mockInsert,
    delete: mockDelete,
    _mockValues: mockValues,
    _mockRun: mockRun,
    _mockWhere: mockWhere,
  } as unknown as DrizzleD1Database & {
    _mockValues: ReturnType<typeof vi.fn>;
    _mockRun: ReturnType<typeof vi.fn>;
    _mockWhere: ReturnType<typeof vi.fn>;
  };
}

function createPersistedNote(): Note<IPersisted> {
  return Note.reconstruct({
    id: "test-uuid-1234",
    title: NoteTitle.create("Test Title"),
    slug: NoteSlug.create("test-slug"),
    etag: ETag.create("test-etag"),
    imageUrl: ImageUrl.create("https://example.com/image.png"),
    publishedOn: testPublishedOn,
    lastModifiedOn: testLastModifiedOn,
    createdAt: testInstant,
    updatedAt: testInstant,
  });
}

function createMockQueryRepository(): INoteQueryRepository {
  const persistedNote = createPersistedNote();
  return {
    findAll: vi.fn(async () => [persistedNote]),
    findBySlug: vi.fn(async () => persistedNote),
  };
}

describe("NoteCommandRepository", () => {
  let db: ReturnType<typeof createMockDb>;
  let queryRepository: INoteQueryRepository;
  let repository: NoteCommandRepository;

  beforeEach(() => {
    db = createMockDb();
    queryRepository = createMockQueryRepository();
    repository = new NoteCommandRepository(db, queryRepository);
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-1234" });
  });

  it("INoteCommandRepository を実装するクラスである", () => {
    expect(NoteCommandRepository).toBeDefined();
    expect(repository.save).toBeDefined();
    expect(repository.delete).toBeDefined();
  });

  describe("save()", () => {
    it("IUnpersisted 状態の Note を受け取り notes テーブルに INSERT し IPersisted 状態の Note を返す", async () => {
      const unpersistedNote = Note.create({
        title: NoteTitle.create("Test Title"),
        slug: NoteSlug.create("test-slug"),
        etag: ETag.create("test-etag"),
        imageUrl: ImageUrl.create("https://example.com/image.png"),
        publishedOn: testPublishedOn,
        lastModifiedOn: testLastModifiedOn,
      });

      db._mockRun.mockResolvedValue({ rowsAffected: 1 });

      const result = await repository.save(unpersistedNote);

      expect(result.id).toBe("test-uuid-1234");
      expect(result.title.toJSON()).toBe("Test Title");
      expect(result.slug.toJSON()).toBe("test-slug");
      expect(result.etag.toJSON()).toBe("test-etag");
      expect(result.imageUrl.toJSON()).toBe("https://example.com/image.png");
      expect(result.publishedOn.toString()).toBe("2026-02-17");
      expect(result.lastModifiedOn.toString()).toBe("2026-02-18");
    });

    it("INSERT 時に publishedOn と lastModifiedOn をテーブルに含める", async () => {
      const unpersistedNote = Note.create({
        title: NoteTitle.create("Test Title"),
        slug: NoteSlug.create("test-slug"),
        etag: ETag.create("test-etag"),
        imageUrl: ImageUrl.create("https://example.com/image.png"),
        publishedOn: testPublishedOn,
        lastModifiedOn: testLastModifiedOn,
      });

      db._mockRun.mockResolvedValue({ rowsAffected: 1 });

      await repository.save(unpersistedNote);

      expect(db._mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          publishedOn: testPublishedOn,
          lastModifiedOn: testLastModifiedOn,
        }),
      );
    });

    it("save 後に queryRepository.findBySlug を呼び出して結果を取得する", async () => {
      const unpersistedNote = Note.create({
        title: NoteTitle.create("Test Title"),
        slug: NoteSlug.create("test-slug"),
        etag: ETag.create("test-etag"),
        imageUrl: ImageUrl.create("https://example.com/image.png"),
        publishedOn: testPublishedOn,
        lastModifiedOn: testLastModifiedOn,
      });

      db._mockRun.mockResolvedValue({ rowsAffected: 1 });

      await repository.save(unpersistedNote);

      expect(queryRepository.findBySlug).toHaveBeenCalledTimes(1);
    });

    it("findBySlug が undefined を返した場合はエラーをスローする", async () => {
      const unpersistedNote = Note.create({
        title: NoteTitle.create("Test Title"),
        slug: NoteSlug.create("test-slug"),
        etag: ETag.create("test-etag"),
        imageUrl: ImageUrl.create("https://example.com/image.png"),
        publishedOn: testPublishedOn,
        lastModifiedOn: testLastModifiedOn,
      });

      db._mockRun.mockResolvedValue({ rowsAffected: 1 });
      // eslint-disable-next-line unicorn/no-useless-undefined
      vi.mocked(queryRepository.findBySlug).mockResolvedValue(undefined);

      await expect(repository.save(unpersistedNote)).rejects.toThrow(
        "Failed to save note",
      );
    });
  });

  describe("delete()", () => {
    it("指定された id のレコードを notes テーブルから削除する", async () => {
      db._mockRun.mockResolvedValue({ rowsAffected: 1 });

      await repository.delete("test-uuid-1234");

      expect(db._mockRun).toHaveBeenCalled();
    });
  });
});
