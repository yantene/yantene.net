import type { articles } from "~/backend/infra/d1/schema";
import type { ArticleStatus } from "~/backend/domain/article";
import {
  ImageUrl,
  Article,
  ArticleSlug,
  ArticleTitle,
  isArticleStatus,
} from "~/backend/domain/article";
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
    status: toArticleStatus(row.status),
    sourceHash: row.sourceHash,
    createdAt: unixToInstant(row.createdAt),
    updatedAt: unixToInstant(row.updatedAt),
  });
}

/**
 * 保存された status を読む。列は text なので、読めない値が入っていたら破損として扱う。
 *
 * **読めない値を「隠す」に倒さない。** 倒すと、破損した行が黙って一覧から消え、
 * 気づく手立ては「記事が減ったこと」しか無くなる (fail-loud)。
 */
function toArticleStatus(value: string): ArticleStatus {
  if (isArticleStatus(value)) return value;
  throw new Error(`articles.status has an unreadable value: ${JSON.stringify(value)}`);
}
