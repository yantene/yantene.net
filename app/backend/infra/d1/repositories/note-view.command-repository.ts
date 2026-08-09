import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { INoteViewCommandRepository } from "~/backend/domain/note-view";
import { noteViewsDaily } from "~/backend/infra/d1/schema";

export class D1NoteViewCommandRepository implements INoteViewCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * その日の行が無ければ 1 で作り、あれば 1 足す。
   *
   * 読み出してから書き戻すのではなく upsert 1 回で済ませているのは、同じ記事が同時に
   * 読まれたときに数を取りこぼさないようにするため。
   */
  async increment(noteId: string, viewedOn: string): Promise<void> {
    await this.db
      .insert(noteViewsDaily)
      .values({ noteId, viewedOn, viewCount: 1 })
      .onConflictDoUpdate({
        target: [noteViewsDaily.noteId, noteViewsDaily.viewedOn],
        set: { viewCount: sql`${noteViewsDaily.viewCount} + 1` },
      });
  }
}
