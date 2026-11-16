import { and, desc, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { pointsAt } from "./content-ref-condition";
import type {
  ContentReactionCount,
  IContentReactionQueryRepository,
} from "~/backend/domain/content-reaction";
import type { ContentRef } from "~/backend/domain/shared";
import { contentReactions } from "~/backend/infra/d1/schema";

export class D1ContentReactionQueryRepository implements IContentReactionQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * コンテンツ 1 つぶんを多い順に返す。
   *
   * 0 の行は落とす。取り消しで 0 になった絵文字は行としては残るが、並べても意味がない。
   * 同数のときの並びは絵文字の昇順にして、読み込むたびに順番が入れ替わらないようにする。
   */
  async listByContent(content: ContentRef): Promise<readonly ContentReactionCount[]> {
    return this.db
      .select({ emoji: contentReactions.emoji, count: contentReactions.count })
      .from(contentReactions)
      .where(and(pointsAt(contentReactions, content), gt(contentReactions.count, 0)))
      .orderBy(desc(contentReactions.count), contentReactions.emoji);
  }
}
