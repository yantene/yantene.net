import type { EmbeddingVector } from "./embedding-vector.vo";
import type { ArticleSlug } from "~/backend/domain/article";
import type { EntityId } from "~/backend/domain/shared";

/**
 * 1 本の記事に対応するベクトルと、それを作ったときの状況。
 *
 * `model` と `contentHash` を一緒に持つのは、作り直すかどうかをこの 2 つで決めるため。
 * 本文が変わったときと、モデルを差し替えたときの両方で作り直したい。
 */
export interface ArticleEmbedding {
  readonly articleId: EntityId<"Article">;
  readonly slug: ArticleSlug;
  /** ベクトルを作ったモデルの識別子。差し替えたら作り直す。 */
  readonly model: string;
  /** 作った時点の記事のリビジョン (articles.source_hash と同じもの)。 */
  readonly contentHash: string;
  readonly vector: EmbeddingVector;
}

/** 記事どうしの近さ。両方向を保存するので、この形のまま 2 行になる。 */
export interface ArticleSimilarity {
  readonly articleId: EntityId<"Article">;
  readonly otherArticleId: EntityId<"Article">;
  readonly similarity: number;
}
