import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { INoteReactionCommandRepository, ReactionEmoji } from "~/backend/domain/note-reaction";
import { noteReactions, notes } from "~/backend/infra/d1/schema";
import { scoreWithWeightAdded, scoreWithWeightRemoved } from "~/backend/infra/d1/view-log-score";

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
    const row = and(eq(noteReactions.noteId, noteId), eq(noteReactions.emoji, emoji.toString()));

    await this.db
      .update(noteReactions)
      .set({ count: sql`max(${noteReactions.count} - 1, 0)` })
      .where(row);
  }

  /**
   * その記事の投稿日を読む。リアクションを外すときの下限を出すのに要る。
   *
   * 日付から重みを作るのは順位付けの意味を決める仕事なので、ここは日付を渡すだけにする。
   * 読んでから書く形になるが、投稿日は閲覧やリアクションでは動かない。間に何が挟まっても
   * 読んだ値は正しいままなので、スコアのような取りこぼしは起きない。
   */
  async findPublishedOn(noteId: string): Promise<string | undefined> {
    const rows = await this.db
      .select({ publishedOn: notes.publishedOn })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    // 分割代入だと型の上では必ず取れることになってしまうので、at で受けて確かめる。
    return rows.at(0)?.publishedOn;
  }

  /**
   * 対数スコアにリアクション 1 つぶんの重みを足す。
   *
   * 閲覧と同じ列を触る。順位はひとつの尺度で決めたいので、リアクションぶんを別の列に
   * 分けず、重みだけを変えて同じ物差しに載せている。
   */
  async addLogScore(noteId: string, weightLog: number): Promise<void> {
    await this.db
      .update(notes)
      .set({ viewLogScore: scoreWithWeightAdded(weightLog) })
      .where(eq(notes.id, noteId));
  }

  /**
   * 対数スコアから、押したときに足したのと同じ重みを引く。
   *
   * 引ききって順位に戻ってこなくならないよう、下限には出発点 (投稿日の重み) を渡す。
   */
  async subtractLogScore(noteId: string, weightLog: number, floorLogScore: number): Promise<void> {
    await this.db
      .update(notes)
      .set({ viewLogScore: scoreWithWeightRemoved(weightLog, floorLogScore) })
      .where(eq(notes.id, noteId));
  }
}
