import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { alias } from "drizzle-orm/sqlite-core";
import type { INoteEmbeddingQueryRepository, NoteEmbedding } from "~/backend/domain/note-embedding";
import type { NoteSlug } from "~/backend/domain/note";
import type { EntityId } from "~/backend/domain/shared";
import { NoteSlug as NoteSlugVo } from "~/backend/domain/note";
import { EmbeddingVector } from "~/backend/domain/note-embedding";
import { noteEmbeddings, noteSimilarities, notes } from "~/backend/infra/d1/schema";

export class D1NoteEmbeddingQueryRepository implements INoteEmbeddingQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async listAll(): Promise<readonly NoteEmbedding[]> {
    const rows = await this.db
      .select({
        noteId: noteEmbeddings.noteId,
        slug: notes.slug,
        model: noteEmbeddings.model,
        contentHash: noteEmbeddings.contentHash,
        vector: noteEmbeddings.vector,
      })
      .from(noteEmbeddings)
      .innerJoin(notes, eq(notes.id, noteEmbeddings.noteId));

    return rows.map((row) => ({
      noteId: row.noteId as EntityId<"Note">,
      slug: NoteSlugVo.create(row.slug),
      model: row.model,
      contentHash: row.contentHash,
      vector: EmbeddingVector.fromBytes(row.vector),
    }));
  }

  /**
   * 近い順に slug を返す。
   *
   * 上位 N 件は保存せず、ここで切る。保存の側で切ると、後から書いた記事が古い記事の
   * 関連ノートに出てこない (refresh は変更のあった記事しか処理しないため)。
   * 同点のときは slug の昇順で決める (並びが実行ごとに揺れないように)。
   */
  async findRelatedSlugs(slug: NoteSlug, limit: number): Promise<readonly string[]> {
    const source = alias(notes, "source_notes");
    const rows = await this.db
      .select({ slug: notes.slug })
      .from(noteSimilarities)
      .innerJoin(source, eq(source.id, noteSimilarities.noteId))
      .innerJoin(notes, eq(notes.id, noteSimilarities.otherNoteId))
      .where(eq(source.slug, slug.toString()))
      .orderBy(desc(noteSimilarities.similarity), notes.slug)
      .limit(limit);
    return rows.map((row) => row.slug);
  }
}
