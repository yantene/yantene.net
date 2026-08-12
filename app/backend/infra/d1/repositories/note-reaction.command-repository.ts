import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  INoteReactionCommandRepository,
  ReactionEmoji,
} from "~/backend/domain/note-reaction";
import { noteReactions, notes } from "~/backend/infra/d1/schema";

export class D1NoteReactionCommandRepository implements INoteReactionCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 数を 1 増やす。行が無ければ 1 で作る。
   *
   * 読んでから書くのではなく upsert 1 手で済ませる。同じ記事に同時に押されても
   * 取りこぼさないようにするため。
   */
  async increment(noteId: string, emoji: ReactionEmoji): Promise<void> {
    await this.db
      .insert(noteReactions)
      .values({ noteId, emoji: emoji.toString(), count: 1 })
      .onConflictDoUpdate({
        target: [noteReactions.noteId, noteReactions.emoji],
        set: { count: sql`${noteReactions.count} + 1` },
      });
  }

  /**
   * 数を 1 減らす。0 は下回らせない。
   *
   * 押していない人からの取り消しが届いても数が負にならないようにする。行が無ければ
   * 何も起きない (作らない)。
   */
  async decrement(noteId: string, emoji: ReactionEmoji): Promise<void> {
    const row = and(
      eq(noteReactions.noteId, noteId),
      eq(noteReactions.emoji, emoji.toString()),
    );

    await this.db
      .update(noteReactions)
      .set({ count: sql`max(${noteReactions.count} - 1, 0)` })
      .where(row);
  }

  async findLogScore(noteId: string): Promise<number | undefined> {
    const rows = await this.db
      .select({ logScore: notes.viewLogScore })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    // 分割代入だと型の上では必ず取れることになってしまうので、at で受けて確かめる。
    return rows.at(0)?.logScore;
  }

  async findScoreContext(
    noteId: string,
  ): Promise<{ logScore: number; publishedOn: string } | undefined> {
    const rows = await this.db
      .select({
        logScore: notes.viewLogScore,
        publishedOn: notes.publishedOn,
      })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    return rows.at(0);
  }

  /**
   * 対数スコアを置き換える。
   *
   * 閲覧と同じ列を触る。順位はひとつの尺度で決めたいので、リアクションぶんを別の列に
   * 分けず、重みだけを変えて同じ物差しに載せている。
   */
  async applyLogScore(noteId: string, logScore: number): Promise<void> {
    await this.db
      .update(notes)
      .set({ viewLogScore: logScore })
      .where(eq(notes.id, noteId));
  }
}
