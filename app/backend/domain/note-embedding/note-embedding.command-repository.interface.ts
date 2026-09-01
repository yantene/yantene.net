import type { NoteEmbedding, NoteSimilarity } from "./note-embedding.entity";
import type { NoteSlug } from "~/backend/domain/note";
import type { EntityId } from "~/backend/domain/shared";

export interface INoteEmbeddingCommandRepository {
  /** ベクトルを保存する (同じノートの行があれば置き換える)。 */
  upsert(embedding: NoteEmbedding): Promise<void>;
  /**
   * 1 本の記事が持つ近さの行を、渡されたもので置き換える。
   *
   * **両方向を書く。** 片方向だけだと、後から書いた記事が古い記事の関連ノートに
   * 出てこない。refresh は変更のあった記事しか処理しないので、古い側の行を更新する
   * 機会が二度と来ないため。
   */
  replaceSimilarities(
    noteId: EntityId<"Note">,
    similarities: readonly NoteSimilarity[],
  ): Promise<void>;
  /** ノートに紐づくベクトルと近さの行を消す。正本から消えたとき用。 */
  deleteBySlug(slug: NoteSlug): Promise<void>;
}
