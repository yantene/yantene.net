import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { ETag } from "../shared/etag.vo";
import { ImageUrl } from "./image-url.vo";
import { NoteSlug } from "./note-slug.vo";
import { NoteTitle } from "./note-title.vo";
import { Note } from "./note.entity";
import { PaginationParams } from "./pagination-params.vo";
import type { INoteQueryRepository } from "./note.query-repository.interface";
import type { PaginatedResult } from "./paginated-result";
import type { IPersisted } from "../persisted.interface";

const createPersistedNote = (): Note<IPersisted> =>
  Note.reconstruct({
    id: "test-id-1",
    title: NoteTitle.create("Test Title"),
    slug: NoteSlug.create("test-slug"),
    etag: ETag.create("test-etag"),
    imageUrl: ImageUrl.create("https://example.com/image.png"),
    publishedOn: Temporal.PlainDate.from("2026-02-17"),
    lastModifiedOn: Temporal.PlainDate.from("2026-02-18"),
    createdAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
    updatedAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
  });

const createMockQueryRepository = (
  notes: readonly Note<IPersisted>[],
): INoteQueryRepository => ({
  findAll: async (): Promise<readonly Note<IPersisted>[]> => notes,
  findBySlug: async (slug: NoteSlug): Promise<Note<IPersisted> | undefined> =>
    notes.find((note) => note.slug.equals(slug)),
  findPaginated: async (
    params: PaginationParams,
  ): Promise<PaginatedResult<Note<IPersisted>>> => {
    const start = params.offset;
    const end = start + params.perPage;
    const paginatedItems = notes.slice(start, end);
    const totalCount = notes.length;
    const totalPages = Math.ceil(totalCount / params.perPage);
    return {
      items: paginatedItems,
      pagination: {
        page: params.page,
        perPage: params.perPage,
        totalCount,
        totalPages,
      },
    };
  },
});

describe("INoteQueryRepository", () => {
  describe("findAll", () => {
    it("IPersisted 状態の Note の readonly 配列を返す", async () => {
      const note = createPersistedNote();
      const repository = createMockQueryRepository([note]);

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(note);
    });

    it("Note が存在しない場合は空配列を返す", async () => {
      const repository = createMockQueryRepository([]);

      const result = await repository.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe("findBySlug", () => {
    it("一致するスラッグの Note を返す", async () => {
      const note = createPersistedNote();
      const repository = createMockQueryRepository([note]);

      const result = await repository.findBySlug(NoteSlug.create("test-slug"));

      expect(result).toBe(note);
    });

    it("一致するスラッグが存在しない場合は undefined を返す", async () => {
      const note = createPersistedNote();
      const repository = createMockQueryRepository([note]);

      const result = await repository.findBySlug(
        NoteSlug.create("non-existent"),
      );

      expect(result).toBeUndefined();
    });
  });

  describe("findPaginated", () => {
    it("PaginationParams を受け取り PaginatedResult を返す", async () => {
      const note = createPersistedNote();
      const repository = createMockQueryRepository([note]);
      const params = PaginationParams.create({ page: "1", perPage: "10" });

      const result = await repository.findPaginated(params);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBe(note);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.perPage).toBe(10);
      expect(result.pagination.totalCount).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it("空の結果でも正しいメタデータを返す", async () => {
      const repository = createMockQueryRepository([]);
      const params = PaginationParams.create({ page: "1", perPage: "10" });

      const result = await repository.findPaginated(params);

      expect(result.items).toHaveLength(0);
      expect(result.pagination.totalCount).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });
});
