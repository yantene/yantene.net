import { Temporal } from "@js-temporal/polyfill";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToNote } from "./note-row";
import type { INoteCommandRepository, Note, NoteId, NoteSlug } from "~/backend/domain/note";
import type { IUnpersisted } from "~/backend/domain/shared";
import { viewWeightLog } from "~/backend/domain/note-view";
import { notes, webmentions } from "~/backend/infra/d1/schema";
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
      sourceHash: note.sourceHash,
      updatedAt: nowUnix,
    };

    const [row] = await this.db
      .insert(notes)
      .values({
        id: crypto.randomUUID(),
        slug: note.slug.toString(),
        createdAt: nowUnix,
        // 人気の出発点は投稿日の重み。content には含めないので、既にある記事を
        // 上書きするときに読まれた実績が巻き戻ることはない。
        viewLogScore: viewWeightLog(plainDateToIso(note.publishedOn)),
        ...content,
      })
      .onConflictDoUpdate({ target: notes.slug, set: content })
      .returning();

    return rowToNote(row);
  }

  async deleteBySlug(slug: NoteSlug): Promise<void> {
    // 子テーブルは FK cascade だが D1 は FK 強制が既定で無効なため明示的に掃除する。
    const noteIds = this.db
      .select({ id: notes.id })
      .from(notes)
      .where(eq(notes.slug, slug.toString()));
    await this.db.delete(webmentions).where(inArray(webmentions.noteId, noteIds));
    await this.db.delete(notes).where(eq(notes.slug, slug.toString()));
  }

  async delete(id: NoteId): Promise<void> {
    await this.db.delete(webmentions).where(eq(webmentions.noteId, id));
    await this.db.delete(notes).where(eq(notes.id, id));
  }
}
