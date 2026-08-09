import { gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  INoteViewQueryRepository,
  NoteScore,
} from "~/backend/domain/note-view";
import { notes } from "~/backend/infra/d1/schema";

export class D1NoteViewQueryRepository implements INoteViewQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * まだ読まれていない記事は落として返す。減衰させても 0 のままで順位に絡まないので、
   * 持ち帰る意味がない。
   */
  async listScores(): Promise<readonly NoteScore[]> {
    const rows = await this.db
      .select({
        noteId: notes.id,
        score: notes.viewScore,
        scoredOn: notes.viewScoredOn,
      })
      .from(notes)
      .where(gt(notes.viewScore, 0));

    return rows;
  }
}
