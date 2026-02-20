export type PaginationMeta = {
  readonly page: number;
  readonly perPage: number;
  readonly totalCount: number;
  readonly totalPages: number;
};

export type PaginatedResult<T> = {
  readonly items: readonly T[];
  readonly pagination: PaginationMeta;
};
