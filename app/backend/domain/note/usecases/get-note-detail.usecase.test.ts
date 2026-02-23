import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ETag } from "../../shared/etag.vo";
import { MarkdownNotFoundError, NoteNotFoundError } from "../errors";
import { ImageUrl } from "../image-url.vo";
import { NoteSlug } from "../note-slug.vo";
import { NoteTitle } from "../note-title.vo";
import { Note } from "../note.entity";
import { GetNoteDetailUseCase } from "./get-note-detail.usecase";
import type { IPersisted } from "../../shared/persisted.interface";
import type { IMarkdownStorage } from "../markdown-storage.interface";
import type { INoteQueryRepository } from "../note.query-repository.interface";

const slug = NoteSlug.create("my-article");

const createPersistedNote = (): Note<IPersisted> =>
  Note.reconstruct({
    id: "note-123",
    title: NoteTitle.create("My Article Title"),
    slug,
    etag: ETag.create("etag-abc"),
    imageUrl: ImageUrl.create("https://example.com/cover.png"),
    summary: "Test summary",
    publishedOn: Temporal.PlainDate.from("2026-02-15"),
    lastModifiedOn: Temporal.PlainDate.from("2026-02-18"),
    createdAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
    updatedAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
  });

const createMarkdownStream = (content: string): ReadableStream => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller): void {
      controller.enqueue(encoder.encode(content));
      controller.close();
    },
  });
};

describe("GetNoteDetailUseCase", () => {
  let mockQueryRepository: INoteQueryRepository;
  let mockMarkdownStorage: IMarkdownStorage;
  let mockFindBySlug: ReturnType<typeof vi.fn>;
  let mockStorageGet: ReturnType<typeof vi.fn>;
  let useCase: GetNoteDetailUseCase;

  beforeEach(() => {
    mockFindBySlug = vi.fn();
    mockStorageGet = vi.fn();
    mockQueryRepository = {
      findAll: vi.fn(),
      findBySlug: mockFindBySlug,
      findPaginated: vi.fn(),
    } as unknown as INoteQueryRepository;
    mockMarkdownStorage = {
      get: mockStorageGet,
      list: vi.fn(),
    } as unknown as IMarkdownStorage;
    useCase = new GetNoteDetailUseCase(
      mockQueryRepository,
      mockMarkdownStorage,
    );
  });

  it("正常系: メタデータと mdast コンテンツを含む結果を返す", async () => {
    const note = createPersistedNote();
    mockFindBySlug.mockResolvedValue(note);

    const markdownContent = `---
title: "My Article Title"
imageUrl: "https://example.com/cover.png"
publishedOn: "2026-02-15"
lastModifiedOn: "2026-02-18"
---

# Introduction

Hello world.
`;
    mockStorageGet.mockResolvedValue({
      body: createMarkdownStream(markdownContent),
      etag: ETag.create("etag-abc"),
    });

    const result = await useCase.execute(slug);

    expect(result.id).toBe("note-123");
    expect(result.title).toBe("My Article Title");
    expect(result.slug).toBe("my-article");
    expect(result.imageUrl).toBe("https://example.com/cover.png");
    expect(result.publishedOn).toBe("2026-02-15");
    expect(result.lastModifiedOn).toBe("2026-02-18");
    expect(result.content.type).toBe("root");
    expect(result.content.children.length).toBeGreaterThan(0);
  });

  it("正常系: frontmatter が mdast content から除去されている", async () => {
    const note = createPersistedNote();
    mockFindBySlug.mockResolvedValue(note);

    const markdownContent = `---
title: "My Article Title"
---

# Hello
`;
    mockStorageGet.mockResolvedValue({
      body: createMarkdownStream(markdownContent),
      etag: ETag.create("etag-abc"),
    });

    const result = await useCase.execute(slug);

    const hasYaml = result.content.children.some(
      (child: { type: string }) => child.type === "yaml",
    );
    expect(hasYaml).toBe(false);
  });

  it("正常系: 日付フィールドが ISO 8601 形式 (YYYY-MM-DD) で返る", async () => {
    const note = createPersistedNote();
    mockFindBySlug.mockResolvedValue(note);
    mockStorageGet.mockResolvedValue({
      body: createMarkdownStream("# Hello"),
      etag: ETag.create("etag-abc"),
    });

    const result = await useCase.execute(slug);

    expect(result.publishedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.lastModifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("記事が DB に存在しない場合は NoteNotFoundError をスローする", async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    mockFindBySlug.mockResolvedValue(undefined);

    await expect(useCase.execute(slug)).rejects.toThrow(NoteNotFoundError);
  });

  it("Markdown がストレージに存在しない場合は MarkdownNotFoundError をスローする", async () => {
    const note = createPersistedNote();
    mockFindBySlug.mockResolvedValue(note);
    // eslint-disable-next-line unicorn/no-useless-undefined
    mockStorageGet.mockResolvedValue(undefined);

    await expect(useCase.execute(slug)).rejects.toThrow(MarkdownNotFoundError);
  });

  it("リポジトリやストレージのエラーはそのままスローする", async () => {
    mockFindBySlug.mockRejectedValue(new Error("DB connection failed"));

    await expect(useCase.execute(slug)).rejects.toThrow("DB connection failed");
  });
});
