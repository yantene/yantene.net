import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it, vi } from "vitest";
import { ImageUrl } from "../domain/note/image-url.vo";
import { NoteSlug } from "../domain/note/note-slug.vo";
import { NoteTitle } from "../domain/note/note-title.vo";
import { Note } from "../domain/note/note.entity";
import { ETag } from "../domain/shared/etag.vo";
import { NotesRefreshService } from "./notes-refresh.service";
import type {
  IMarkdownStorage,
  MarkdownContent,
  MarkdownListItem,
} from "../domain/note/markdown-storage.interface";
import type { INoteCommandRepository } from "../domain/note/note.command-repository.interface";
import type { INoteQueryRepository } from "../domain/note/note.query-repository.interface";
import type { IPersisted } from "../domain/shared/persisted.interface";

const testInstant = Temporal.Instant.from("2026-01-01T00:00:00Z");

const FRONTMATTER_CONTENT = `---
title: "Test Article"
imageUrl: "https://example.com/image.png"
publishedOn: "2026-01-15"
lastModifiedOn: "2026-02-10"
---

Content here.
`;

function createReadableStream(text: string): ReadableStream {
  return new ReadableStream({
    start(controller): void {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function createMarkdownContent(etag: string): MarkdownContent {
  return {
    body: createReadableStream(FRONTMATTER_CONTENT),
    etag: ETag.create(etag),
  };
}

function createPersistedNote(params: {
  slug: string;
  etag: string;
}): Note<IPersisted> {
  return Note.reconstruct({
    id: `id-${params.slug}`,
    title: NoteTitle.create("Title"),
    slug: NoteSlug.create(params.slug),
    etag: ETag.create(params.etag),
    imageUrl: ImageUrl.create("https://example.com/image.png"),
    summary: "",
    publishedOn: Temporal.PlainDate.from("2026-01-15"),
    lastModifiedOn: Temporal.PlainDate.from("2026-02-10"),
    createdAt: testInstant,
    updatedAt: testInstant,
  });
}

function createMockStorage(
  listItems: MarkdownListItem[],
  getResult?: MarkdownContent,
): IMarkdownStorage {
  return {
    list: vi.fn().mockResolvedValue(listItems),
    get: vi.fn().mockResolvedValue(getResult),
  };
}

function createMockQueryRepository(
  notes: Note<IPersisted>[],
): INoteQueryRepository {
  return {
    findAll: vi.fn().mockResolvedValue(notes),
    findBySlug: vi.fn(),
    findPaginated: vi.fn(),
  };
}

function createMockCommandRepository(): INoteCommandRepository {
  return {
    save: vi.fn(),
    upsert: vi
      .fn()
      .mockResolvedValue(
        createPersistedNote({ slug: "mock", etag: "mock-etag" }),
      ),
    delete: vi.fn(),
    deleteBySlug: vi.fn(),
  };
}

describe("NotesRefreshService", () => {
  describe("execute()", () => {
    it("R2 にあり D1 にない記事を追加する", async () => {
      const storage = createMockStorage(
        [
          {
            slug: NoteSlug.create("new-article"),
            etag: ETag.create("etag-new"),
          },
        ],
        createMarkdownContent("etag-new"),
      );
      const queryRepository = createMockQueryRepository([]);
      const commandRepository = createMockCommandRepository();

      const service = new NotesRefreshService(
        storage,
        queryRepository,
        commandRepository,
      );
      const result = await service.execute();

      expect(result.added).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.deleted).toBe(0);
      expect(storage.get).toHaveBeenCalledWith(NoteSlug.create("new-article"));
      expect(commandRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: expect.objectContaining({ value: "new-article" }),
          etag: expect.objectContaining({ value: "etag-new" }),
          title: expect.objectContaining({ value: "Test Article" }),
          imageUrl: expect.objectContaining({
            value: "https://example.com/image.png",
          }),
        }),
      );
    });

    it("etag が異なる記事を更新する", async () => {
      const storage = createMockStorage(
        [
          {
            slug: NoteSlug.create("existing-article"),
            etag: ETag.create("etag-new"),
          },
        ],
        createMarkdownContent("etag-new"),
      );
      const queryRepository = createMockQueryRepository([
        createPersistedNote({ slug: "existing-article", etag: "etag-old" }),
      ]);
      const commandRepository = createMockCommandRepository();

      const service = new NotesRefreshService(
        storage,
        queryRepository,
        commandRepository,
      );
      const result = await service.execute();

      expect(result.added).toBe(0);
      expect(result.updated).toBe(1);
      expect(result.deleted).toBe(0);
      expect(storage.get).toHaveBeenCalledWith(
        NoteSlug.create("existing-article"),
      );
      expect(commandRepository.upsert).toHaveBeenCalledTimes(1);
    });

    it("D1 にあり R2 にない記事を削除する", async () => {
      const storage = createMockStorage([]);
      const queryRepository = createMockQueryRepository([
        createPersistedNote({ slug: "deleted-article", etag: "etag-old" }),
      ]);
      const commandRepository = createMockCommandRepository();

      const service = new NotesRefreshService(
        storage,
        queryRepository,
        commandRepository,
      );
      const result = await service.execute();

      expect(result.added).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.deleted).toBe(1);
      expect(commandRepository.deleteBySlug).toHaveBeenCalledWith(
        NoteSlug.create("deleted-article"),
      );
    });

    it("etag が同じ記事はスキップする", async () => {
      const storage = createMockStorage([
        {
          slug: NoteSlug.create("unchanged-article"),
          etag: ETag.create("etag-same"),
        },
      ]);
      const queryRepository = createMockQueryRepository([
        createPersistedNote({ slug: "unchanged-article", etag: "etag-same" }),
      ]);
      const commandRepository = createMockCommandRepository();

      const service = new NotesRefreshService(
        storage,
        queryRepository,
        commandRepository,
      );
      const result = await service.execute();

      expect(result.added).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.deleted).toBe(0);
      expect(commandRepository.upsert).not.toHaveBeenCalled();
      expect(commandRepository.deleteBySlug).not.toHaveBeenCalled();
      expect(storage.get).not.toHaveBeenCalled();
    });

    it("追加・更新・削除の混在を正しく処理する", async () => {
      const getMock = vi.fn();
      getMock.mockResolvedValueOnce(createMarkdownContent("etag-new"));
      getMock.mockResolvedValueOnce(createMarkdownContent("etag-updated-new"));

      const storage: IMarkdownStorage = {
        list: vi.fn().mockResolvedValue([
          {
            slug: NoteSlug.create("new-article"),
            etag: ETag.create("etag-new"),
          },
          {
            slug: NoteSlug.create("updated-article"),
            etag: ETag.create("etag-updated-new"),
          },
          {
            slug: NoteSlug.create("unchanged-article"),
            etag: ETag.create("etag-same"),
          },
        ] satisfies MarkdownListItem[]),
        get: getMock,
      };

      const queryRepository = createMockQueryRepository([
        createPersistedNote({
          slug: "updated-article",
          etag: "etag-updated-old",
        }),
        createPersistedNote({ slug: "unchanged-article", etag: "etag-same" }),
        createPersistedNote({ slug: "deleted-article", etag: "etag-deleted" }),
      ]);
      const commandRepository = createMockCommandRepository();

      const service = new NotesRefreshService(
        storage,
        queryRepository,
        commandRepository,
      );
      const result = await service.execute();

      expect(result.added).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.deleted).toBe(1);
    });

    it("R2 と D1 がともに空の場合は全件数 0 を返す", async () => {
      const storage = createMockStorage([]);
      const queryRepository = createMockQueryRepository([]);
      const commandRepository = createMockCommandRepository();

      const service = new NotesRefreshService(
        storage,
        queryRepository,
        commandRepository,
      );
      const result = await service.execute();

      expect(result.added).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.deleted).toBe(0);
    });

    it("追加時に frontmatter から publishedOn と lastModifiedOn を正しく抽出する", async () => {
      const storage = createMockStorage(
        [
          {
            slug: NoteSlug.create("my-article"),
            etag: ETag.create("etag-1"),
          },
        ],
        createMarkdownContent("etag-1"),
      );
      const queryRepository = createMockQueryRepository([]);
      const commandRepository = createMockCommandRepository();

      const service = new NotesRefreshService(
        storage,
        queryRepository,
        commandRepository,
      );
      await service.execute();

      expect(commandRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          publishedOn: Temporal.PlainDate.from("2026-01-15"),
          lastModifiedOn: Temporal.PlainDate.from("2026-02-10"),
        }),
      );
    });
  });
});
