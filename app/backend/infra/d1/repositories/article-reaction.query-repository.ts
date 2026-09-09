import { and, desc, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  IArticleReactionQueryRepository,
  ArticleReactionCount,
} from "~/backend/domain/article-reaction";
import { articleReactions } from "~/backend/infra/d1/schema";

export class D1ArticleReactionQueryRepository implements IArticleReactionQueryRepository {
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
  async listByArticleId(articleId: string): Promise<readonly ArticleReactionCount[]> {
    return this.db
      .select({ emoji: articleReactions.emoji, count: articleReactions.count })
      .from(articleReactions)
      .where(and(eq(articleReactions.articleId, articleId), gt(articleReactions.count, 0)))
      .orderBy(desc(articleReactions.count), articleReactions.emoji);
  }
}
