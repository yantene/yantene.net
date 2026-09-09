import type { articles } from "~/backend/infra/d1/schema";
import { ImageUrl, Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import { entityId } from "~/backend/domain/shared";
import { isoToPlainDate, unixToInstant } from "~/backend/infra/d1/temporal";

/**
 * D1 の行を Article エンティティに復元する。Command / Query リポジトリで共有する。
 * slug / title / imageUrl は保存時に VO 経由で検証済みなので、ここでの再検証は
 * 破損データの検知を兼ねる (不正なら VO factory が throw する)。
 */
export function rowToArticle(row: typeof articles.$inferSelect): Article {
  return Article.reconstruct({
    id: entityId<"Article">(row.id),
    slug: ArticleSlug.create(row.slug),
    title: ArticleTitle.create(row.title),
    summary: row.summary,
    imageUrl: row.imageUrl === null ? undefined : ImageUrl.create(row.imageUrl),
    publishedOn: isoToPlainDate(row.publishedOn),
    lastModifiedOn: isoToPlainDate(row.lastModifiedOn),
    sourceHash: row.sourceHash,
    createdAt: unixToInstant(row.createdAt),
    updatedAt: unixToInstant(row.updatedAt),
  });
}
