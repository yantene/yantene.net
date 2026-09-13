import { asc, desc, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { IArticleViewQueryRepository } from "~/backend/domain/article-view";
import { articleStatuses, isListedToReaders } from "~/backend/domain/article";
import { articles } from "~/backend/infra/d1/schema";

/**
 * 人気順に出してよい status (ADR 0040)。
 *
 * この表は記事の読み取り口 (D1ArticleQueryRepository) を通らず D1 を直接引くので、
 * 絞るのはここ。素通りさせると**上位 N 件を下書きが埋めてから forReaders が落とす**
 * ことになり、人気順が N 件に足りなくなる。
 */
const LISTED_STATUSES = articleStatuses.filter((status) => isListedToReaders(status));

export class D1ArticleViewQueryRepository implements IArticleViewQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 索引に沿って上位だけを引く。対数は単調なので、この並びがそのまま人気順になる。
   * 全件を持ち帰って畳み直す必要はないため、記事が増えても重くならない。
   *
   * まだ読まれていない記事も候補に含める。出発点が投稿日の重みになっているので、
   * 読まれていなくても新しい記事ほど上に来る。絞らずに済むのはそのためで、公開直後の
   * 記事が「まだ誰も読んでいないから」という理由だけで消えることもない。
   *
   * 同点なら新しく公開したものを上に置く。同じだけ読まれているなら、まだ読まれる目の
   * ある方を見せたい。公開日まで並ぶことも有りうるので、最後は id で決める。並びが
   * 実行ごとに揺れると、順位が理由もなく入れ替わってしまう。
   */
  async listPopularArticleIds(limit: number): Promise<readonly string[]> {
    const rows = await this.db
      .select({ id: articles.id })
      .from(articles)
      .where(inArray(articles.status, LISTED_STATUSES))
      .orderBy(desc(articles.viewLogScore), desc(articles.publishedOn), asc(articles.id))
      .limit(limit);

    return rows.map((row) => row.id);
  }
}
