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
    const orderBy = query.direction === "asc" ? asc(column) : desc(column);

    const rows = await this.db
      .select()
      .from(notes)
      .orderBy(orderBy)
      .limit(query.limit)
      .offset(query.offset);

    const [{ value: total }] = await this.db
      .select({ value: count() })
      .from(notes);

    return { notes: rows.map((row) => rowToNote(row)), total };
  }
}
