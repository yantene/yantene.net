import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { ETag } from "../shared/etag.vo";
import { ImageUrl } from "./image-url.vo";
import { NoteSlug } from "./note-slug.vo";
import { NoteTitle } from "./note-title.vo";
import { Note } from "./note.entity";
import type { INoteCommandRepository } from "./note.command-repository.interface";
import type { IPersisted } from "../persisted.interface";
import type { IUnpersisted } from "../unpersisted.interface";

describe("INoteCommandRepository", () => {
  const createUnpersistedNote = (): Note<IUnpersisted> =>
    Note.create({
      title: NoteTitle.create("テスト記事"),
      slug: NoteSlug.create("test-article"),
      etag: ETag.create("abc123"),
      imageUrl: ImageUrl.create("https://example.com/image.png"),
    });

  const createPersistedNote = (): Note<IPersisted> =>
    Note.reconstruct({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: NoteTitle.create("テスト記事"),
      slug: NoteSlug.create("test-article"),
      etag: ETag.create("abc123"),
      imageUrl: ImageUrl.create("https://example.com/image.png"),
      createdAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
      updatedAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
    });

  it("save メソッドが IUnpersisted な Note を受け取り IPersisted な Note を返す", async () => {
    const persistedNote = createPersistedNote();

    const repository: INoteCommandRepository = {
      save: async (_note: Note<IUnpersisted>): Promise<Note<IPersisted>> =>
        persistedNote,
      delete: async (_id: string): Promise<void> => {},
    };

    const unpersistedNote = createUnpersistedNote();
    const result = await repository.save(unpersistedNote);

    expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.title.toJSON()).toBe("テスト記事");
    expect(result.slug.toJSON()).toBe("test-article");
  });

  it("delete メソッドが id を受け取り void を返す", async () => {
    let deletedId: string | undefined;

    const repository: INoteCommandRepository = {
      save: async (_note: Note<IUnpersisted>): Promise<Note<IPersisted>> =>
        createPersistedNote(),
      delete: async (id: string): Promise<void> => {
        deletedId = id;
      },
    };

    await repository.delete("550e8400-e29b-41d4-a716-446655440000");

    expect(deletedId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});
