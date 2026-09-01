import { Temporal } from "@js-temporal/polyfill";
import { notInArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  INoteEmbeddingCommandRepository,
  NoteEmbedding,
  NoteSimilarity,
} from "~/backend/domain/note-embedding";
import { noteEmbeddings, noteSimilarities, notes } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";

/** 1 文あたりの行数。D1 のバインドパラメータ上限 (100) に収まる数で切る。 */
const SIMILARITY_ROWS_PER_STATEMENT = 30;

export class D1NoteEmbeddingCommandRepository implements INoteEmbeddingCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async upsert(embedding: NoteEmbedding): Promise<void> {
    const nowUnix = instantToUnix(Temporal.Now.instant());
    const content = {
      model: embedding.model,
      contentHash: embedding.contentHash,
      dimensions: embedding.vector.dimensions,
      vector: embedding.vector.toBytes(),
      updatedAt: nowUnix,
    };
    await this.db
      .insert(noteEmbeddings)
      .values({ noteId: embedding.noteId, createdAt: nowUnix, ...content })
      .onConflictDoUpdate({ target: noteEmbeddings.noteId, set: content });
  }

  /**
   * 近さの行を全部入れ替える。
   *
   * 消してから入れるところまでを 1 つの batch にまとめる。D1 の batch は暗黙の
   * トランザクションなので、途中で落ちても「全記事の関連ノートが空」の状態は表に出ない。
   */
  async replaceAllSimilarities(similarities: readonly NoteSimilarity[]): Promise<void> {
    // 両方向を書く。読むときに OR で引かずに済ませるため (note-similarities.ts)。
    const rows = similarities.flatMap((pair) => [
      { noteId: pair.noteId, otherNoteId: pair.otherNoteId, similarity: pair.similarity },
      { noteId: pair.otherNoteId, otherNoteId: pair.noteId, similarity: pair.similarity },
    ]);
    const inserts = [];
    for (let index = 0; index < rows.length; index += SIMILARITY_ROWS_PER_STATEMENT) {
      inserts.push(
        this.db
          .insert(noteSimilarities)
          .values(rows.slice(index, index + SIMILARITY_ROWS_PER_STATEMENT)),
      );
    }
    await this.db.batch([this.db.delete(noteSimilarities), ...inserts]);
  }

  /** 対応する記事がもう無い行を消す。D1 は外部キーを既定で強制しないので明示的に掃除する。 */
  async deleteOrphans(): Promise<void> {
    const liveIds = this.db.select({ id: notes.id }).from(notes);
    await this.db.delete(noteEmbeddings).where(notInArray(noteEmbeddings.noteId, liveIds));
    await this.db
      .delete(noteSimilarities)
      .where(
        or(
          notInArray(noteSimilarities.noteId, liveIds),
          notInArray(noteSimilarities.otherNoteId, liveIds),
        ),
      );
  }
}
