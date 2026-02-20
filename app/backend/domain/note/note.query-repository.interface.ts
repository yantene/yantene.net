import type { IPersisted } from "../persisted.interface";
import type { NoteSlug } from "./note-slug.vo";
import type { Note } from "./note.entity";
import type { PaginatedResult } from "../shared/pagination/paginated-result";
import type { PaginationParams } from "../shared/pagination/pagination-params.vo";

export interface INoteQueryRepository {
  findAll(): Promise<readonly Note<IPersisted>[]>;
  findBySlug(slug: NoteSlug): Promise<Note<IPersisted> | undefined>;
  findPaginated(
    params: PaginationParams,
  ): Promise<PaginatedResult<Note<IPersisted>>>;
}
