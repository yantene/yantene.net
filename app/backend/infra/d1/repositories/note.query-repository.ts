import { asc, count, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToNote } from "./note-row";
import type {
  INoteQueryRepository,
  Note,
  NoteListQuery,
  NoteListResult,
  NoteSlug,
  NoteSortField,
} from "~/backend/domain/note";
import { notes } from "~/backend/infra/d1/schema";

const sortColumns = {
  publishedOn: notes.publishedOn,
  lastModifiedOn: notes.lastModifiedOn,
} as const satisfies Record<NoteSortField, unknown>;

export class D1NoteQueryRepository implements INoteQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async findBySlug(slug: NoteSlug): Promise<Note | undefined> {
    const rows = await this.db
      .select()
      .from(notes)
      .where(eq(notes.slug, slug.toString()))
      .limit(1);
    const row = rows.at(0);
    return row === undefined ? undefined : rowToNote(row);
  }

  async list(query: NoteListQuery): Promise<NoteListResult> {
    const column = sortColumns[query.sortBy];
    const primary = query.direction === "asc" ? asc(column) : desc(column);
    // 同じ日付のノート同士でも順序を安定させる決定的なタイブレーカ。slug は UNIQUE
    // なので offset ページネーションで行の重複・欠落が起きない。
    const tiebreaker = asc(notes.slug);

    // 行取得と総件数取得は独立なので並行実行する (公開一覧のホットパスの往復を半減)。
    const [rows, [{ value: total }]] = await Promise.all([
      this.db
        .select()
        .from(notes)
        .orderBy(primary, tiebreaker)
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ value: count() }).from(notes),
    ]);

    return { notes: rows.map((row) => rowToNote(row)), total };
  }

  async listSourceHashes(): Promise<ReadonlyMap<string, string>> {
    const rows = await this.db
      .select({ slug: notes.slug, sourceHash: notes.sourceHash })
      .from(notes);
    return new Map(rows.map((row) => [row.slug, row.sourceHash]));
  }
}
