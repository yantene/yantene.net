import type { NoteEmbedding, NoteSimilarity } from "./note-embedding.entity";

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
  /**
   * 対応する記事がもう無い行を消す。
   *
   * slug で名指しして消す形は採れない。ノートの同期が先に記事を消すので、後から
   * 呼ばれるこちらからは slug から id を引けなくなっている。残った行は読み出しの
   * innerJoin から外れるので表には出ないが、置いたままだと容量だけが増える。
   */
  deleteOrphans(): Promise<void>;
}
