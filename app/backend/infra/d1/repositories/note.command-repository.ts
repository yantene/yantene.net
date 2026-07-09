import { Temporal } from "@js-temporal/polyfill";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToNote } from "./note-row";
import type {
  INoteCommandRepository,
  Note,
  NoteId,
  NoteSlug,
} from "~/backend/domain/note";
import type { IUnpersisted } from "~/backend/domain/shared";
import { noteTags, notes } from "~/backend/infra/d1/schema";
import { instantToUnix, plainDateToIso } from "~/backend/infra/d1/temporal";

export class D1NoteCommandRepository implements INoteCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * slug をキーに upsert する。新規なら id と created_at を採番し、既存なら
   * それらを保持したまま内容と updated_at を更新する。RETURNING で確定行を取り、
   * タグ (note_tags) を入れ直してから永続化済みエンティティを復元して返す。
   */
  async upsert(note: Note<IUnpersisted>): Promise<Note> {
    const now = Temporal.Now.instant();
    const nowUnix = instantToUnix(now);
    const content = {
      title: note.title.toString(),
      summary: note.summary,
      imageUrl: note.imageUrl?.toString() ?? null,
      publishedOn: plainDateToIso(note.publishedOn),
      lastModifiedOn: plainDateToIso(note.lastModifiedOn),
      series: note.series?.name ?? null,
      seriesSlug: note.series?.slug ?? null,
      seriesOrder: note.series?.order ?? null,
      sourceHash: note.sourceHash,
      updatedAt: nowUnix,
    };

    const [row] = await this.db
      .insert(notes)
      .values({
        id: crypto.randomUUID(),
        slug: note.slug.toString(),
        createdAt: nowUnix,
        ...content,
      })
      .onConflictDoUpdate({ target: notes.slug, set: content })
      .returning();

    await this.replaceTags(row.id, note.tags);

    return rowToNote(row, note.tags);
  }

  /** ノートのタグを丸ごと入れ替える (差分計算より単純で確実)。重複タグは除去する。 */
  private async replaceTags(noteId: string, tags: Note["tags"]): Promise<void> {
    await this.db.delete(noteTags).where(eq(noteTags.noteId, noteId));
    const unique = [...new Set(tags.map((tag) => tag.toString()))];
    if (unique.length > 0) {
      await this.db
        .insert(noteTags)
        .values(unique.map((tag) => ({ noteId, tag })));
    }
  }

  async deleteBySlug(slug: NoteSlug): Promise<void> {
    // note_tags は FK cascade だが D1 は FK 強制が既定で無効なため明示的に掃除する。
    const noteIds = this.db
      .select({ id: notes.id })
      .from(notes)
      .where(eq(notes.slug, slug.toString()));
    await this.db.delete(noteTags).where(inArray(noteTags.noteId, noteIds));
    await this.db.delete(notes).where(eq(notes.slug, slug.toString()));
  }

  async delete(id: NoteId): Promise<void> {
    await this.db.delete(noteTags).where(eq(noteTags.noteId, id));
    await this.db.delete(notes).where(eq(notes.id, id));
  }
}
