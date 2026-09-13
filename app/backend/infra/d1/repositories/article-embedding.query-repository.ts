import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { alias } from "drizzle-orm/sqlite-core";
import type {
  IArticleEmbeddingQueryRepository,
  ArticleEmbedding,
} from "~/backend/domain/article-embedding";
import type { ArticleSlug } from "~/backend/domain/article";
import type { EntityId } from "~/backend/domain/shared";
import {
  ArticleSlug as ArticleSlugVo,
  articleStatuses,
  isListedToReaders,
} from "~/backend/domain/article";
import { EmbeddingVector } from "~/backend/domain/article-embedding";
import { articleEmbeddings, articleSimilarities, articles } from "~/backend/infra/d1/schema";

/** 関連記事として差し出してよい status (ADR 0040)。 */
const LISTED_STATUSES = articleStatuses.filter((status) => isListedToReaders(status));

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
      .where(
        and(
          eq(source.slug, slug.toString()),
          /*
           * 読み手に差し出せる相手だけを数える (ADR 0040)。
           *
           * この表はリポジトリの読み取り口を通らずに引かれるので、絞るのはここ。
           * 素通りさせると**上位 N 件を下書きが埋めてから forReaders が落とす**ので、
           * 公開記事の関連記事が N 件に足りなくなる (検索の索引と人気順で潰したのと
           * 同じ穴が、ここにも開いていた)。
           */
          inArray(articles.status, LISTED_STATUSES),
        ),
      )
      .orderBy(desc(articleSimilarities.similarity), articles.slug)
      .limit(limit);
    return rows.map((row) => row.slug);
  }
}
