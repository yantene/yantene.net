import type { IPersisted } from "../../persisted.interface";
import type { PaginatedResult } from "../../shared/pagination/paginated-result";
import type { PaginationParams } from "../../shared/pagination/pagination-params.vo";
import type { Note } from "../note.entity";
import type { INoteQueryRepository } from "../note.query-repository.interface";

export class ListNotesUseCase {
  constructor(private readonly queryRepository: INoteQueryRepository) {}

  execute(
    params: PaginationParams,
  ): Promise<PaginatedResult<Note<IPersisted>>> {
    return this.queryRepository.findPaginated(params);
  }
}
