import { count as drizzleCount, desc, eq } from "drizzle-orm";
import { ImageUrl } from "../../../domain/note/image-url.vo";
import { NoteSlug } from "../../../domain/note/note-slug.vo";
import { NoteTitle } from "../../../domain/note/note-title.vo";
import { Note } from "../../../domain/note/note.entity";
import { ETag } from "../../../domain/shared/etag.vo";
import { notes } from "../schema/notes.table";
import type { INoteQueryRepository } from "../../../domain/note/note.query-repository.interface";
import type { PaginatedResult } from "../../../domain/shared/pagination/paginated-result";
import type { PaginationParams } from "../../../domain/shared/pagination/pagination-params.vo";
import type { IPersisted } from "../../../domain/shared/persisted.interface";
import type { Temporal } from "@js-temporal/polyfill";
import type { DrizzleD1Database } from "drizzle-orm/d1";

type NoteRow = {
  id: string;
  title: string;
  slug: string;
  etag: string;
  imageUrl: string;
  publishedOn: Temporal.PlainDate;
  lastModifiedOn: Temporal.PlainDate;
  createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
};

export class NoteQueryRepository implements INoteQueryRepository {
  constructor(private readonly db: DrizzleD1Database) {}

  async findAll(): Promise<readonly Note<IPersisted>[]> {
    const rows = await this.db.select().from(notes).all();

    return rows.map((row) => this.toEntity(row as NoteRow));
  }

  async findBySlug(slug: NoteSlug): Promise<Note<IPersisted> | undefined> {
    const row = await this.db
      .select()
      .from(notes)
      .where(eq(notes.slug, slug.value))
      .get();

    if (!row) {
      return undefined;
    }

    return this.toEntity(row as NoteRow);
  }

  async findPaginated(
    params: PaginationParams,
  ): Promise<PaginatedResult<Note<IPersisted>>> {
    const countResult = await this.db
      .select({ count: drizzleCount() })
      .from(notes)
      .get();

    const totalCount = countResult?.count ?? 0;
    const totalPages = Math.ceil(totalCount / params.perPage);

    const rows = await this.db
      .select()
      .from(notes)
      .orderBy(desc(notes.publishedOn))
      .offset(params.offset)
      .limit(params.perPage)
      .all();

    const items = rows.map((row) => this.toEntity(row as NoteRow));

    return {
      items,
      pagination: {
        page: params.page,
        perPage: params.perPage,
        totalCount,
        totalPages,
      },
    };
  }

  private toEntity(row: NoteRow): Note<IPersisted> {
    return Note.reconstruct({
      id: row.id,
      title: NoteTitle.create(row.title),
      slug: NoteSlug.create(row.slug),
      etag: ETag.create(row.etag),
      imageUrl: ImageUrl.create(row.imageUrl),
      publishedOn: row.publishedOn,
      lastModifiedOn: row.lastModifiedOn,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
