import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { BatchItem } from "drizzle-orm/batch";
import { legacyArticleId, pointsAt } from "./content-ref-condition";
import type {
  IContentReactionCommandRepository,
  ReactionEmoji,
} from "~/backend/domain/content-reaction";
import type { ContentRef } from "~/backend/domain/shared";
import {
  articleReactions,
  articles,
  contentReactions,
  contentViews,
} from "~/backend/infra/d1/schema";
import { scoreWithWeightAdded, scoreWithWeightRemoved } from "~/backend/infra/d1/view-log-score";

/**
 * リアクションの数とスコアを書き換える。
 *
 * どの書き込みも、旧い表 (`article_reactions` と `articles.view_log_score`) へ同じ batch で
 * 入れている (#566)。片方だけ進んだ姿を残さないため。旧い表への書き込みは
 * どれも `legacyArticleId` を通しているので、旧い表を落とすときはそこから辿って消す。
 */
export class D1ContentReactionCommandRepository implements IContentReactionCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 数を 1 増やす。行が無ければ 1 で作る。
   *
   * 読んでから書くのではなく upsert 1 手で済ませる。同じものに同時に押されても
   * 取りこぼさないようにするため。
   */
  async increment(content: ContentRef, emoji: ReactionEmoji): Promise<void> {
    await this.db.batch([
      this.db
        .insert(contentReactions)
        .values({ kind: content.kind, contentId: content.id, emoji: emoji.toString(), count: 1 })
        .onConflictDoUpdate({
          target: [contentReactions.kind, contentReactions.contentId, contentReactions.emoji],
          set: { count: sql`${contentReactions.count} + 1` },
        }),
      this.incrementInLegacyTable(legacyArticleId(content), emoji),
    ]);
  }

  /**
   * 数を 1 減らす。0 は下回らせない。
   *
   * 押していない人からの取り消しが届いても数が負にならないようにする。行が無ければ
   * 何も起きない (作らない)。
   */
  async decrement(content: ContentRef, emoji: ReactionEmoji): Promise<void> {
    await this.db.batch([
      this.db
        .update(contentReactions)
        .set({ count: sql`max(${contentReactions.count} - 1, 0)` })
        .where(
          and(pointsAt(contentReactions, content), eq(contentReactions.emoji, emoji.toString())),
        ),
      this.decrementInLegacyTable(legacyArticleId(content), emoji),
    ]);
  }

  /**
   * 指す先の投稿日を読む。リアクションを外すときの下限を出すのに要る。
   *
   * 日付から重みを作るのは順位付けの意味を決める仕事なので、ここは日付を渡すだけにする。
   * 読んでから書く形になるが、投稿日は閲覧やリアクションでは動かない。間に何が挟まっても
   * 読んだ値は正しいままなので、スコアのような取りこぼしは起きない。
   */
  async findPublishedOn(content: ContentRef): Promise<string | undefined> {
    switch (content.kind) {
      case "article": {
        return this.findArticlePublishedOn(content.id);
      }
    }
  }

  /**
   * 対数スコアにリアクション 1 つぶんの重みを足す。
   *
   * 閲覧と同じ列を触る。順位はひとつの尺度で決めたいので、リアクションぶんを別の列に
   * 分けず、重みだけを変えて同じ物差しに載せている。
   */
  async addLogScore(content: ContentRef, weightLog: number): Promise<void> {
    await this.db.batch([
      this.db
        .update(contentViews)
        .set({ viewLogScore: scoreWithWeightAdded(contentViews.viewLogScore, weightLog) })
        .where(pointsAt(contentViews, content)),
      this.db
        .update(articles)
        .set({ viewLogScore: scoreWithWeightAdded(articles.viewLogScore, weightLog) })
        .where(eq(articles.id, legacyArticleId(content))),
    ]);
  }

  /**
   * 対数スコアから、押したときに足したのと同じ重みを引く。
   *
   * 引ききって順位に戻ってこなくならないよう、下限には出発点 (投稿日の重み) を渡す。
   */
  async subtractLogScore(
    content: ContentRef,
    weightLog: number,
    floorLogScore: number,
  ): Promise<void> {
    await this.db.batch([
      this.db
        .update(contentViews)
        .set({
          viewLogScore: scoreWithWeightRemoved(contentViews.viewLogScore, weightLog, floorLogScore),
        })
        .where(pointsAt(contentViews, content)),
      this.db
        .update(articles)
        .set({
          viewLogScore: scoreWithWeightRemoved(articles.viewLogScore, weightLog, floorLogScore),
        })
        .where(eq(articles.id, legacyArticleId(content))),
    ]);
  }

  private async findArticlePublishedOn(articleId: string): Promise<string | undefined> {
    const rows = await this.db
      .select({ publishedOn: articles.publishedOn })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    // 分割代入だと型の上では必ず取れることになってしまうので、at で受けて確かめる。
    return rows.at(0)?.publishedOn;
  }

  /** 旧い表への書き込み。旧い表を落とすときに消す。 */
  private incrementInLegacyTable(articleId: string, emoji: ReactionEmoji): BatchItem<"sqlite"> {
    return this.db
      .insert(articleReactions)
      .values({ articleId, emoji: emoji.toString(), count: 1 })
      .onConflictDoUpdate({
        target: [articleReactions.articleId, articleReactions.emoji],
        set: { count: sql`${articleReactions.count} + 1` },
      });
  }

  /** 旧い表への書き込み。旧い表を落とすときに消す。 */
  private decrementInLegacyTable(articleId: string, emoji: ReactionEmoji): BatchItem<"sqlite"> {
    return this.db
      .update(articleReactions)
      .set({ count: sql`max(${articleReactions.count} - 1, 0)` })
      .where(
        and(
          eq(articleReactions.articleId, articleId),
          eq(articleReactions.emoji, emoji.toString()),
        ),
      );
  }
}
