import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { IContentViewQueryRepository } from "~/backend/domain/content-view";
import type { ContentKind, ContentRef } from "~/backend/domain/shared";
import { articleStatuses, isListedToReaders } from "~/backend/domain/article";
import { isContentKind } from "~/backend/domain/shared";
import { articles, contentViews } from "~/backend/infra/d1/schema";

/**
 * 人気順に出してよい記事の status (ADR 0040)。
 *
 * この読み取りは記事の読み取り口 (D1ArticleQueryRepository) を通らず D1 を直接引くので、
 * 絞るのはここ。素通りさせると**上位 N 件を下書きが埋めてから forReaders が落とす**
 * ことになり、人気順が N 件に足りなくなる。
 */
const LISTED_ARTICLE_STATUSES = articleStatuses.filter((status) => isListedToReaders(status));

const ARTICLE_KIND: ContentKind = "article";

export class D1ContentViewQueryRepository implements IContentViewQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * SQL の側で並べて上位だけを引く。対数は単調なので、この並びがそのまま人気順になる。
   * 全件を持ち帰って畳み直すことはしない。
   *
   * 候補は種別ごとの部分クエリが出し、スコアは content_views が持つ。**読み手に差し出して
   * よいかは、種別ごとの部分クエリの中で絞る** (何をもって公開とするかは種別が決める)。
   * 結合のあとで絞る形にはしない。
   *
   * まだ読まれていないものも候補に含める。出発点が投稿日の重みになっているので、
   * 読まれていなくても新しいものほど上に来る。絞らずに済むのはそのためで、公開直後の
   * 記事が「まだ誰も読んでいないから」という理由だけで消えることもない。
   *
   * 同点なら新しく公開したものを上に置く。同じだけ読まれているなら、まだ読まれる目の
   * ある方を見せたい。公開日まで並ぶことも有りうるので、最後は id で決める。並びが
   * 実行ごとに揺れると、順位が理由もなく入れ替わってしまう。
   */
  async listPopular(limit: number): Promise<readonly ContentRef[]> {
    /*
     * 読み手に差し出してよいコンテンツ。種別ごとの (kind, id, 公開日) を並べたもの。
     * いま在る種別は記事だけ。種別を足すときは、その種別の公開の条件を書いた部分クエリを
     * ここに `UNION ALL` で継ぐ。
     */
    const listed = this.db
      .select({
        // 別名は content_views.kind と重ならない名にする。外側からは修飾なしで引かれる。
        kind: sql<string>`${ARTICLE_KIND}`.as("listed_kind"),
        id: articles.id,
        publishedOn: articles.publishedOn,
      })
      .from(articles)
      .where(inArray(articles.status, LISTED_ARTICLE_STATUSES))
      .as("listed");

    const rows = await this.db
      .select({ kind: listed.kind, id: listed.id })
      .from(listed)
      .innerJoin(
        contentViews,
        and(eq(contentViews.kind, listed.kind), eq(contentViews.contentId, listed.id)),
      )
      .orderBy(desc(contentViews.viewLogScore), desc(listed.publishedOn), asc(listed.id))
      .limit(limit);

    return rows.map((row) => toContentRef(row));
  }
}

/** 読めない種別が返ってきたら、黙って落とさずに止める (fail-loud)。 */
function toContentRef(row: { kind: string; id: string }): ContentRef {
  if (!isContentKind(row.kind)) throw new Error(`unknown content kind: ${row.kind}`);

  return { kind: row.kind, id: row.id };
}
