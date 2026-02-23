import { Temporal } from "@js-temporal/polyfill";
import { eq } from "drizzle-orm";
import { notes } from "../schema/notes.table";
import type { NoteSlug } from "../../../domain/note/note-slug.vo";
import type { INoteCommandRepository } from "../../../domain/note/note.command-repository.interface";
import type { Note } from "../../../domain/note/note.entity";
import type { INoteQueryRepository } from "../../../domain/note/note.query-repository.interface";
import type { IPersisted } from "../../../domain/shared/persisted.interface";
import type { IUnpersisted } from "../../../domain/shared/unpersisted.interface";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export class NoteCommandRepository implements INoteCommandRepository {
  constructor(
    private readonly db: DrizzleD1Database,
    private readonly queryRepository: INoteQueryRepository,
  ) {}

  async save(note: Note<IUnpersisted>): Promise<Note<IPersisted>> {
    const id = crypto.randomUUID();
    const now = Temporal.Now.instant();

    await this.db
      .insert(notes)
      .values({
        id,
        title: note.title.value,
        slug: note.slug.value,
        etag: note.etag.value,
        imageUrl: note.imageUrl.value,
        summary: note.summary,
        publishedOn: note.publishedOn,
        lastModifiedOn: note.lastModifiedOn,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = await this.queryRepository.findBySlug(note.slug);
    if (!result) {
      throw new Error("Failed to save note");
    }

    return result;
  }

  async upsert(note: Note<IUnpersisted>): Promise<Note<IPersisted>> {
    const id = crypto.randomUUID();
    const now = Temporal.Now.instant();

    await this.db
      .insert(notes)
      .values({
        id,
        title: note.title.value,
        slug: note.slug.value,
        etag: note.etag.value,
        imageUrl: note.imageUrl.value,
        summary: note.summary,
        publishedOn: note.publishedOn,
        lastModifiedOn: note.lastModifiedOn,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: notes.slug,
        set: {
          title: note.title.value,
          etag: note.etag.value,
          imageUrl: note.imageUrl.value,
          summary: note.summary,
          publishedOn: note.publishedOn,
          lastModifiedOn: note.lastModifiedOn,
          updatedAt: now,
        },
      })
      .run();

    const result = await this.queryRepository.findBySlug(note.slug);
    if (!result) {
      throw new Error("Failed to upsert note");
    }

    return result;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(notes).where(eq(notes.id, id)).run();
  }

  async deleteBySlug(slug: NoteSlug): Promise<void> {
    await this.db.delete(notes).where(eq(notes.slug, slug.value)).run();
  }
}
