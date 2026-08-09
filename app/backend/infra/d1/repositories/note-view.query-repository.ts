import { desc, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { INoteViewQueryRepository } from "~/backend/domain/note-view";
import { notes } from "~/backend/infra/d1/schema";

export class D1NoteViewQueryRepository implements INoteViewQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 索引に沿って上位だけを引く。対数は単調なので、この並びがそのまま人気順になる。
   * 全件を持ち帰って畳み直す必要はないため、記事が増えても重くならない。
   */
  async listPopularNoteIds(limit: number): Promise<readonly string[]> {
    const rows = await this.db
      .select({ id: notes.id })
      .from(notes)
      .where(isNotNull(notes.viewLogScore))
      .orderBy(desc(notes.viewLogScore))
      .limit(limit);

    return rows.map((row) => row.id);
  }
}
