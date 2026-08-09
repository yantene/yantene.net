import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  INoteViewCommandRepository,
  NoteScore,
} from "~/backend/domain/note-view";
import { notes } from "~/backend/infra/d1/schema";

export class D1NoteViewCommandRepository implements INoteViewCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async findScore(noteId: string): Promise<NoteScore | undefined> {
    const rows = await this.db
      .select({ score: notes.viewScore, scoredOn: notes.viewScoredOn })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    // 分割代入だと型の上では必ず取れることになってしまうので、at で受けて確かめる。
    const row = rows.at(0);
    return row === undefined
      ? undefined
      : { noteId, score: row.score, scoredOn: row.scoredOn };
  }

  /**
   * 累計は SQL 側で 1 足し、スコアは受け取った値で置き換える。
   *
   * 累計を SQL で足しているのは、同じ記事が同時に読まれても取りこぼさないため。
   * スコアは減衰を挟むので、その場の値では決められず、計算済みの値を書くしかない。
   */
  async applyView(
    noteId: string,
    score: number,
    scoredOn: string,
  ): Promise<void> {
    await this.db
      .update(notes)
      .set({
        viewCount: sql`${notes.viewCount} + 1`,
        viewScore: score,
        viewScoredOn: scoredOn,
      })
      .where(eq(notes.id, noteId));
  }
}
