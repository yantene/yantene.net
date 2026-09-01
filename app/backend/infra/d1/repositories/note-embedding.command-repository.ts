import { Temporal } from "@js-temporal/polyfill";
import { eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  INoteEmbeddingCommandRepository,
  NoteEmbedding,
  NoteSimilarity,
} from "~/backend/domain/note-embedding";
import type { NoteSlug } from "~/backend/domain/note";
import type { EntityId } from "~/backend/domain/shared";
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

  async deleteBySlug(slug: NoteSlug): Promise<void> {
    const [row] = await this.db
      .select({ id: notes.id })
      .from(notes)
      .where(eq(notes.slug, slug.toString()))
      .limit(1);
    if (row === undefined) return;
    const noteId = row.id as EntityId<"Note">;
    await this.deleteSimilaritiesOf(noteId);
    await this.db.delete(noteEmbeddings).where(eq(noteEmbeddings.noteId, noteId));
  }

  /** 両方向ぶん消す。D1 は外部キーを既定で強制しないので、ここで明示的に掃除する。 */
  private async deleteSimilaritiesOf(noteId: EntityId<"Note">): Promise<void> {
    await this.db
      .delete(noteSimilarities)
      .where(or(eq(noteSimilarities.noteId, noteId), eq(noteSimilarities.otherNoteId, noteId)));
  }
}
