import type { IPersisted } from "../persisted.interface";
import type { NoteSlug } from "./note-slug.vo";
import type { Note } from "./note.entity";
import type { PaginatedResult } from "./paginated-result";
import type { PaginationParams } from "./pagination-params.vo";

export interface INoteQueryRepository {
  findAll(): Promise<readonly Note<IPersisted>[]>;
  findBySlug(slug: NoteSlug): Promise<Note<IPersisted> | undefined>;
  findPaginated(
    params: PaginationParams,
  ): Promise<PaginatedResult<Note<IPersisted>>>;
}
