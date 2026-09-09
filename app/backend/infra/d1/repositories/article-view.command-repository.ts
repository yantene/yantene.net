import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { INoteViewCommandRepository } from "~/backend/domain/note-view";
import { notes } from "~/backend/infra/d1/schema";
import { scoreWithWeightAdded } from "~/backend/infra/d1/view-log-score";

export class D1NoteViewCommandRepository implements INoteViewCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 累計を 1 増やし、対数スコアにその日の重みを足す。どちらも SQL 側で今の値から作る。
   *
   * 読んでから書き戻す形にはしない。2 手の間に別の閲覧やリアクションが挟まると、
   * 後から書いたほうが先の加算を上書きして消してしまうため。
   *
   * 記事が無ければ 1 行も当たらず、何も起きない。
   */
  async addView(noteId: string, weightLog: number): Promise<void> {
    await this.db
      .update(notes)
      .set({
        viewCount: sql`${notes.viewCount} + 1`,
        viewLogScore: scoreWithWeightAdded(weightLog),
      })
      .where(eq(notes.id, noteId));
  }
}
