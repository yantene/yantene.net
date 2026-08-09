import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { INoteViewCommandRepository } from "~/backend/domain/note-view";
import { notes } from "~/backend/infra/d1/schema";

export class D1NoteViewCommandRepository implements INoteViewCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async findLogScore(noteId: string): Promise<number | null | undefined> {
    const rows = await this.db
      .select({ logScore: notes.viewLogScore })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    // 分割代入だと型の上では必ず取れることになってしまうので、at で受けて確かめる。
    return rows.at(0)?.logScore;
  }

  /**
   * 累計は SQL 側で 1 足し、対数スコアは受け取った値で置き換える。
   *
   * 累計を SQL で足しているのは、同じ記事が同時に読まれても取りこぼさないため。
   */
  async applyView(noteId: string, logScore: number): Promise<void> {
    await this.db
      .update(notes)
      .set({ viewCount: sql`${notes.viewCount} + 1`, viewLogScore: logScore })
      .where(eq(notes.id, noteId));
  }
}
