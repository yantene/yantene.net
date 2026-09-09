import type { Webmention } from "./webmention.entity";
import type { ArticleId } from "~/backend/domain/article";

export interface IWebmentionQueryRepository {
  /** 1 記事ぶんを、受け取った順 (古い順) に返す。 */
  listByArticleId(articleId: ArticleId): Promise<readonly Webmention[]>;
}
