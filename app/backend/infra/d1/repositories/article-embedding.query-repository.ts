import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { alias } from "drizzle-orm/sqlite-core";
import type {
  IArticleEmbeddingQueryRepository,
  ArticleEmbedding,
} from "~/backend/domain/article-embedding";
import type { ArticleSlug } from "~/backend/domain/article";
import type { EntityId } from "~/backend/domain/shared";
import { ArticleSlug as ArticleSlugVo } from "~/backend/domain/article";
import { EmbeddingVector } from "~/backend/domain/article-embedding";
import { articleEmbeddings, articleSimilarities, articles } from "~/backend/infra/d1/schema";

export class D1ArticleEmbeddingQueryRepository implements IArticleEmbeddingQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async listAll(): Promise<readonly ArticleEmbedding[]> {
    const rows = await this.db
      .select({
        articleId: articleEmbeddings.articleId,
        slug: articles.slug,
        model: articleEmbeddings.model,
        contentHash: articleEmbeddings.contentHash,
        vector: articleEmbeddings.vector,
      })
      .from(articleEmbeddings)
      .innerJoin(articles, eq(articles.id, articleEmbeddings.articleId));

    return rows.map((row) => ({
      articleId: row.articleId as EntityId<"Article">,
      slug: ArticleSlugVo.create(row.slug),
      model: row.model,
      contentHash: row.contentHash,
      vector: EmbeddingVector.fromBytes(row.vector),
    }));
  }

  /**
   * 近い順に slug を返す。
   *
   * 上位 N 件は保存せず、ここで切る。保存の側で切ると、後から書いた記事が古い記事の
   * 関連記事に出てこない (refresh は変更のあった記事しか処理しないため)。
   * 同点のときは slug の昇順で決める (並びが実行ごとに揺れないように)。
   */
  async findRelatedSlugs(slug: ArticleSlug, limit: number): Promise<readonly string[]> {
    const source = alias(articles, "source_articles");
    const rows = await this.db
      .select({ slug: articles.slug })
      .from(articleSimilarities)
      .innerJoin(source, eq(source.id, articleSimilarities.articleId))
      .innerJoin(articles, eq(articles.id, articleSimilarities.otherArticleId))
      .where(eq(source.slug, slug.toString()))
      .orderBy(desc(articleSimilarities.similarity), articles.slug)
      .limit(limit);
    return rows.map((row) => row.slug);
  }
}
