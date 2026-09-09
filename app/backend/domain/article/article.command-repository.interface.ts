import type { ArticleSlug } from "./article-slug.vo";
import type { Article, ArticleId } from "./article.entity";
import type { IUnpersisted } from "~/backend/domain/shared";

export interface IArticleCommandRepository {
  /**
   * 記事のメタデータを slug をキーに upsert する。
   * refresh 時に正本の内容で D1 を同期するための操作。
   * 既存 slug があれば更新、無ければ新規作成し、永続化済みエンティティを返す。
   */
  upsert(article: Article<IUnpersisted>): Promise<Article>;

  /** slug の記事を削除する (正本から消えた記事の掃除に使う)。 */
  deleteBySlug(slug: ArticleSlug): Promise<void>;

  /** id の記事を削除する。 */
  delete(id: ArticleId): Promise<void>;
}
