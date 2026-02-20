import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ETag } from "../../shared/etag.vo";
import { ImageUrl } from "../image-url.vo";
import { NoteSlug } from "../note-slug.vo";
import { NoteTitle } from "../note-title.vo";
import { Note } from "../note.entity";
import { PaginationParams } from "../pagination-params.vo";
import { ListNotesUseCase } from "./list-notes.usecase";
import type { IPersisted } from "../../persisted.interface";
import type { INoteQueryRepository } from "../note.query-repository.interface";
import type { PaginatedResult } from "../paginated-result";

const createPersistedNote = (id: string): Note<IPersisted> =>
  Note.reconstruct({
    id,
    title: NoteTitle.create(`Title ${id}`),
    slug: NoteSlug.create(`slug-${id}`),
    etag: ETag.create("etag-1"),
    imageUrl: ImageUrl.create("https://example.com/image.png"),
    publishedOn: Temporal.PlainDate.from("2026-02-17"),
    lastModifiedOn: Temporal.PlainDate.from("2026-02-18"),
    createdAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
    updatedAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
  });

describe("ListNotesUseCase", () => {
  let mockQueryRepository: INoteQueryRepository;
  let mockFindPaginated: ReturnType<typeof vi.fn>;
  let useCase: ListNotesUseCase;

  beforeEach(() => {
    mockFindPaginated = vi.fn();
    mockQueryRepository = {
      findAll: vi.fn(),
      findBySlug: vi.fn(),
      findPaginated: mockFindPaginated,
    } as unknown as INoteQueryRepository;
    useCase = new ListNotesUseCase(mockQueryRepository);
  });

  it("PaginationParams をリポジトリの findPaginated に委譲する", async () => {
    const params = PaginationParams.create({ page: "1", perPage: "10" });
    const expectedResult: PaginatedResult<Note<IPersisted>> = {
      items: [],
      pagination: { page: 1, perPage: 10, totalCount: 0, totalPages: 0 },
    };
    mockFindPaginated.mockResolvedValue(expectedResult);

    await useCase.execute(params);

    expect(mockFindPaginated).toHaveBeenCalledWith(params);
    expect(mockFindPaginated).toHaveBeenCalledTimes(1);
  });

  it("リポジトリの結果をそのまま返却する", async () => {
    const note = createPersistedNote("note-1");
    const params = PaginationParams.create({ page: "1", perPage: "20" });
    const expectedResult: PaginatedResult<Note<IPersisted>> = {
      items: [note],
      pagination: { page: 1, perPage: 20, totalCount: 1, totalPages: 1 },
    };
    mockFindPaginated.mockResolvedValue(expectedResult);

    const result = await useCase.execute(params);

    expect(result).toBe(expectedResult);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("note-1");
    expect(result.pagination.totalCount).toBe(1);
  });

  it("範囲外のページでも空配列と正確なメタデータを返却する", async () => {
    const params = PaginationParams.create({ page: "100", perPage: "20" });
    const expectedResult: PaginatedResult<Note<IPersisted>> = {
      items: [],
      pagination: { page: 100, perPage: 20, totalCount: 5, totalPages: 1 },
    };
    mockFindPaginated.mockResolvedValue(expectedResult);

    const result = await useCase.execute(params);

    expect(result.items).toHaveLength(0);
    expect(result.pagination.page).toBe(100);
    expect(result.pagination.totalCount).toBe(5);
    expect(result.pagination.totalPages).toBe(1);
  });

  it("リポジトリがエラーをスローした場合、そのままスローする", async () => {
    const params = PaginationParams.create({});
    mockFindPaginated.mockRejectedValue(new Error("DB error"));

    await expect(useCase.execute(params)).rejects.toThrow("DB error");
  });
});
