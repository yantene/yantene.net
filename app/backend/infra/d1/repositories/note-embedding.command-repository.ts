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
   * この記事に紐づく近さの行を入れ替える。
   *
   * 消してから入れるのは、記事が減ったときに古い相手との行が残らないようにするため。
   * 途中で落ちるとその記事の関連ノートが一時的に空になるが、次の refresh で入り直す
   * (ベクトルの側は消していないので、作り直しも要らない)。
   */
  async replaceSimilarities(
    noteId: EntityId<"Note">,
    similarities: readonly NoteSimilarity[],
  ): Promise<void> {
    await this.deleteSimilaritiesOf(noteId);
    // 両方向を書く。片方向だと、後から書いた記事が古い記事の関連ノートに出てこない。
    const rows = similarities.flatMap((pair) => [
      { noteId: pair.noteId, otherNoteId: pair.otherNoteId, similarity: pair.similarity },
      { noteId: pair.otherNoteId, otherNoteId: pair.noteId, similarity: pair.similarity },
    ]);
    // 直前に両方向を消してあるので、素の insert で足りる。
    for (let index = 0; index < rows.length; index += SIMILARITY_ROWS_PER_STATEMENT) {
      await this.db
        .insert(noteSimilarities)
        .values(rows.slice(index, index + SIMILARITY_ROWS_PER_STATEMENT));
    }
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
