import type { NoteEmbedding, NoteSimilarity } from "./note-embedding.entity";
import type { NoteSlug } from "~/backend/domain/note";

export interface INoteEmbeddingCommandRepository {
  /** ベクトルを保存する (同じノートの行があれば置き換える)。 */
  upsert(embedding: NoteEmbedding): Promise<void>;
  /**
   * 近さの行を全部入れ替える。
   *
   * 中心化した類似度は**コーパス全体の平均**を引いて出すので、記事が 1 本増えるだけで
   * 既存どうしのペアの値まで動く。1 記事ぶんずつ書き替えると、違う平均で出した値が
   * 同じ表に並んで比べられなくなるため、まとめて書き直す。
   */
  replaceAllSimilarities(similarities: readonly NoteSimilarity[]): Promise<void>;
  /** ノートに紐づくベクトルと近さの行を消す。正本から消えたとき用。 */
  deleteBySlug(slug: NoteSlug): Promise<void>;
}
