import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToWebmention } from "./webmention-row";
import type { NoteId } from "~/backend/domain/note";
import type {
  IWebmentionQueryRepository,
  Webmention,
} from "~/backend/domain/webmention";
import { webmentions } from "~/backend/infra/d1/schema";

export class D1WebmentionQueryRepository implements IWebmentionQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 1 記事ぶんを受け取った順に返す。
   *
   * 同じ時刻に入った行の並びは source の昇順で決める。読み込むたびに順番が
   * 入れ替わらないようにするため。
   */
  async listByNoteId(noteId: NoteId): Promise<readonly Webmention[]> {
    const rows = await this.db
      .select()
      .from(webmentions)
      .where(eq(webmentions.noteId, noteId))
      .orderBy(webmentions.receivedAt, webmentions.source);

    return rows.map((row) => rowToWebmention(row));
  }
}
