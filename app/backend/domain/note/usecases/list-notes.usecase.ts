import type { IPersisted } from "../../persisted.interface";
import type { Note } from "../note.entity";
import type { INoteQueryRepository } from "../note.query-repository.interface";
import type { PaginatedResult } from "../paginated-result";
import type { PaginationParams } from "../pagination-params.vo";

export class ListNotesUseCase {
  constructor(private readonly queryRepository: INoteQueryRepository) {}

  execute(
    params: PaginationParams,
  ): Promise<PaginatedResult<Note<IPersisted>>> {
    return this.queryRepository.findPaginated(params);
  }
}
