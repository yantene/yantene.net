import { gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  DailyViewCount,
  INoteViewQueryRepository,
} from "~/backend/domain/note-view";
import { noteViewsDaily } from "~/backend/infra/d1/schema";

export class D1NoteViewQueryRepository implements INoteViewQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 日付で絞った行をそのまま返す。重み付けはドメイン側で行う。
   *
   * 日付は ISO 文字列で持っているので、辞書順の比較がそのまま日付の比較になる。
   */
  async listDailyCountsSince(
    since: string,
  ): Promise<readonly DailyViewCount[]> {
    const rows = await this.db
      .select({
        noteId: noteViewsDaily.noteId,
        viewedOn: noteViewsDaily.viewedOn,
        viewCount: noteViewsDaily.viewCount,
      })
      .from(noteViewsDaily)
      .where(gte(noteViewsDaily.viewedOn, since));

    return rows;
  }
}
