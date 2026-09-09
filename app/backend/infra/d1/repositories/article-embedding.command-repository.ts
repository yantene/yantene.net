import { Temporal } from "@js-temporal/polyfill";
import { notInArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  IArticleEmbeddingCommandRepository,
  ArticleEmbedding,
  ArticleSimilarity,
} from "~/backend/domain/article-embedding";
import { articleEmbeddings, articleSimilarities, articles } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";

/** 1 文あたりの行数。D1 のバインドパラメータ上限 (100) に収まる数で切る。 */
const SIMILARITY_ROWS_PER_STATEMENT = 30;

export class D1ArticleEmbeddingCommandRepository implements IArticleEmbeddingCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async upsert(embedding: ArticleEmbedding): Promise<void> {
    const nowUnix = instantToUnix(Temporal.Now.instant());
    const content = {
      model: embedding.model,
      contentHash: embedding.contentHash,
      dimensions: embedding.vector.dimensions,
      vector: embedding.vector.toBytes(),
      updatedAt: nowUnix,
    };
    await this.db
      .insert(articleEmbeddings)
      .values({ articleId: embedding.articleId, createdAt: nowUnix, ...content })
      .onConflictDoUpdate({ target: articleEmbeddings.articleId, set: content });
  }

  /**
   * 近さの行を全部入れ替える。
   *
   * 消してから入れるところまでを 1 つの batch にまとめる。D1 の batch は暗黙の
   * トランザクションなので、途中で落ちても「全記事の関連記事が空」の状態は表に出ない。
   */
  async replaceAllSimilarities(similarities: readonly ArticleSimilarity[]): Promise<void> {
    // 両方向を書く。読むときに OR で引かずに済ませるため (article-similarities.ts)。
    const rows = similarities.flatMap((pair) => [
      {
        articleId: pair.articleId,
        otherArticleId: pair.otherArticleId,
        similarity: pair.similarity,
      },
      {
        articleId: pair.otherArticleId,
        otherArticleId: pair.articleId,
        similarity: pair.similarity,
      },
    ]);
    const inserts = [];
    for (let index = 0; index < rows.length; index += SIMILARITY_ROWS_PER_STATEMENT) {
      inserts.push(
        this.db
          .insert(articleSimilarities)
          .values(rows.slice(index, index + SIMILARITY_ROWS_PER_STATEMENT)),
      );
    }
    await this.db.batch([this.db.delete(articleSimilarities), ...inserts]);
  }

  /** 対応する記事がもう無い行を消す。D1 は外部キーを既定で強制しないので明示的に掃除する。 */
  async deleteOrphans(): Promise<void> {
    const liveIds = this.db.select({ id: articles.id }).from(articles);
    await this.db.delete(articleEmbeddings).where(notInArray(articleEmbeddings.articleId, liveIds));
    await this.db
      .delete(articleSimilarities)
      .where(
        or(
          notInArray(articleSimilarities.articleId, liveIds),
          notInArray(articleSimilarities.otherArticleId, liveIds),
        ),
      );
  }
}
