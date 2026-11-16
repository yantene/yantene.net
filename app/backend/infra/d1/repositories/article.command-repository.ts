import { Temporal } from "@js-temporal/polyfill";
import { type SQL, and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { BatchItem } from "drizzle-orm/batch";
import { rowToArticle } from "./article-row";
import type {
  IArticleCommandRepository,
  Article,
  ArticleId,
  ArticleSlug,
} from "~/backend/domain/article";
import type { ContentKind, IUnpersisted } from "~/backend/domain/shared";
import { viewWeightLog } from "~/backend/domain/content-view";
import { articles, contentReactions, contentViews, webmentions } from "~/backend/infra/d1/schema";
import { instantToUnix, plainDateToIso } from "~/backend/infra/d1/temporal";

/** 反応と閲覧数の表で、記事を指す行の種別。 */
const ARTICLE_KIND: ContentKind = "article";

export class D1ArticleCommandRepository implements IArticleCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * slug をキーに upsert する。新規なら id と created_at を採番し、既存なら
   * それらを保持したまま内容と updated_at を更新する。RETURNING で確定行を取り、
   * 永続化済みエンティティを復元して返す。
   *
   * 閲覧数の行 (content_views) も同じ batch で用意する。人気順はこの行と結合して
   * 並べるので、**行が無い記事は順位に出てこない**。記事はあるのに行が無い姿を
   * 表に出さないよう、1 つの batch (D1 の暗黙のトランザクション) に収める。
   */
  async upsert(article: Article<IUnpersisted>): Promise<Article> {
    const now = Temporal.Now.instant();
    const nowUnix = instantToUnix(now);
    const slug = article.slug.toString();
    const content = {
      title: article.title.toString(),
      summary: article.summary,
      imageUrl: article.imageUrl?.toString() ?? null,
      publishedOn: plainDateToIso(article.publishedOn),
      lastModifiedOn: plainDateToIso(article.lastModifiedOn),
      // status は content に入れる。書き換えたら上書きされてほしい (公開 → 取り下げ、
      // 下書き → 公開のどちらも、次の refresh でそのまま反映される)。
      status: article.status,
      sourceHash: article.sourceHash,
      updatedAt: nowUnix,
    };

    const [rows] = await this.db.batch([
      this.db
        .insert(articles)
        .values({
          id: crypto.randomUUID(),
          slug,
          createdAt: nowUnix,
          // 人気の出発点は投稿日の重み。content には含めないので、既にある記事を
          // 上書きするときに読まれた実績が巻き戻ることはない。
          viewLogScore: viewWeightLog(plainDateToIso(article.publishedOn)),
          ...content,
        })
        .onConflictDoUpdate({ target: articles.slug, set: content })
        .returning(),
      this.ensureViewsRow(slug),
    ]);

    const row = rows.at(0);
    if (row === undefined) throw new Error(`upsert returned no row: ${slug}`);

    return rowToArticle(row);
  }

  async deleteBySlug(slug: ArticleSlug): Promise<void> {
    const articleIds = this.db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, slug.toString()));

    await this.deleteWithDependents(inArray(articles.id, articleIds), {
      webmentions: inArray(webmentions.articleId, articleIds),
      reactions: inArray(contentReactions.contentId, articleIds),
      views: inArray(contentViews.contentId, articleIds),
    });
  }

  async delete(id: ArticleId): Promise<void> {
    await this.deleteWithDependents(eq(articles.id, id), {
      webmentions: eq(webmentions.articleId, id),
      reactions: eq(contentReactions.contentId, id),
      views: eq(contentViews.contentId, id),
    });
  }

  /**
   * 記事と、記事を指している行を 1 つの batch で消す。
   *
   * 反応と閲覧数の表は種別をまたいで持つので FK を張れない (ADR 0051)。記事と一緒に
   * 消えてくれないので、ここで明示的に掃除する。残すと、消えた記事の数が表に溜まる。
   * 種別も併せて絞るのは、同じ id が別の種別に在っても巻き込まないため。
   *
   * 記事そのものを最後に消す。slug から id を引く部分クエリが、先に消すと空になる。
   */
  private async deleteWithDependents(
    target: SQL,
    dependents: { webmentions: SQL; reactions: SQL; views: SQL },
  ): Promise<void> {
    await this.db.batch([
      this.db.delete(webmentions).where(dependents.webmentions),
      this.db
        .delete(contentReactions)
        .where(and(eq(contentReactions.kind, ARTICLE_KIND), dependents.reactions)),
      this.db
        .delete(contentViews)
        .where(and(eq(contentViews.kind, ARTICLE_KIND), dependents.views)),
      this.db.delete(articles).where(target),
    ]);
  }

  /**
   * その記事の閲覧数の行が無ければ作る。在れば触らない。
   *
   * 触らないのは、作り直しや取り下げで読まれた実績が巻き戻らないようにするため。
   *
   * 値は旧い列 (`articles.view_count` / `view_log_score`) から写す。新しい記事なら
   * 直前の insert が入れた出発点 (投稿日の重み) が、行だけが欠けていた記事なら旧い列に
   * 積まれていた実績がそのまま入る。**旧い列を落とすときは、出発点を直に渡す形に直す**
   * (#566)。
   */
  private ensureViewsRow(slug: string): BatchItem<"sqlite"> {
    return this.db
      .insert(contentViews)
      .select(
        this.db
          .select({
            kind: sql<string>`${ARTICLE_KIND}`.as("kind"),
            contentId: articles.id,
            viewCount: articles.viewCount,
            viewLogScore: articles.viewLogScore,
          })
          .from(articles)
          .where(eq(articles.slug, slug)),
      )
      .onConflictDoNothing();
  }
}
