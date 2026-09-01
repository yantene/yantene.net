import type { NoteEmbedding } from "./note-embedding.entity";
import type { NoteSlug } from "~/backend/domain/note";

export interface INoteEmbeddingQueryRepository {
  /**
   * 保存済みのベクトルを全部返す。
   *
   * 全ペアの計算に使う。57 本 x 1024 次元で 0.22 MB しかないので、近似最近傍も
   * ベクトルデータベースも要らない。数千本を超えたらこの前提が崩れる。
   */
  listAll(): Promise<readonly NoteEmbedding[]>;
  /** 近い順に slug を返す。関連ノートの表示に使う。 */
  findRelatedSlugs(slug: NoteSlug, limit: number): Promise<readonly string[]>;
}
