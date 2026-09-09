import { and, desc, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  INoteReactionQueryRepository,
  NoteReactionCount,
} from "~/backend/domain/note-reaction";
import { noteReactions } from "~/backend/infra/d1/schema";

export class D1NoteReactionQueryRepository implements INoteReactionQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 1 記事ぶんを多い順に返す。
   *
   * 0 の行は落とす。取り消しで 0 になった絵文字は行としては残るが、並べても意味がない。
   * 同数のときの並びは絵文字の昇順にして、読み込むたびに順番が入れ替わらないようにする。
   */
  async listByNoteId(noteId: string): Promise<readonly NoteReactionCount[]> {
    return this.db
      .select({ emoji: noteReactions.emoji, count: noteReactions.count })
      .from(noteReactions)
      .where(and(eq(noteReactions.noteId, noteId), gt(noteReactions.count, 0)))
      .orderBy(desc(noteReactions.count), noteReactions.emoji);
  }
}
