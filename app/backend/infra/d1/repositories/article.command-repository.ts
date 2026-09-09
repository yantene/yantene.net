import { Temporal } from "@js-temporal/polyfill";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToArticle } from "./article-row";
import type {
  IArticleCommandRepository,
  Article,
  ArticleId,
  ArticleSlug,
} from "~/backend/domain/article";
import type { IUnpersisted } from "~/backend/domain/shared";
import { viewWeightLog } from "~/backend/domain/article-view";
import { articles, webmentions } from "~/backend/infra/d1/schema";
import { instantToUnix, plainDateToIso } from "~/backend/infra/d1/temporal";

export class D1ArticleCommandRepository implements IArticleCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * slug をキーに upsert する。新規なら id と created_at を採番し、既存なら
   * それらを保持したまま内容と updated_at を更新する。RETURNING で確定行を取り、
   * タグ (article_tags) を入れ直してから永続化済みエンティティを復元して返す。
   */
  async upsert(article: Article<IUnpersisted>): Promise<Article> {
    const now = Temporal.Now.instant();
    const nowUnix = instantToUnix(now);
    const content = {
      title: article.title.toString(),
      summary: article.summary,
      imageUrl: article.imageUrl?.toString() ?? null,
      publishedOn: plainDateToIso(article.publishedOn),
      lastModifiedOn: plainDateToIso(article.lastModifiedOn),
      sourceHash: article.sourceHash,
      updatedAt: nowUnix,
    };

    const [row] = await this.db
      .insert(articles)
      .values({
        id: crypto.randomUUID(),
        slug: article.slug.toString(),
        createdAt: nowUnix,
        // 人気の出発点は投稿日の重み。content には含めないので、既にある記事を
        // 上書きするときに読まれた実績が巻き戻ることはない。
        viewLogScore: viewWeightLog(plainDateToIso(article.publishedOn)),
        ...content,
      })
      .onConflictDoUpdate({ target: articles.slug, set: content })
      .returning();

    return rowToArticle(row);
  }

  async deleteBySlug(slug: ArticleSlug): Promise<void> {
    // 子テーブルは FK cascade だが D1 は FK 強制が既定で無効なため明示的に掃除する。
    const articleIds = this.db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, slug.toString()));
    await this.db.delete(webmentions).where(inArray(webmentions.articleId, articleIds));
    await this.db.delete(articles).where(eq(articles.slug, slug.toString()));
  }

  async delete(id: ArticleId): Promise<void> {
    await this.db.delete(webmentions).where(eq(webmentions.articleId, id));
    await this.db.delete(articles).where(eq(articles.id, id));
  }
}
