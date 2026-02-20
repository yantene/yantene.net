export class PaginationValidationError extends Error {
  readonly name = "PaginationValidationError" as const;

  constructor(
    readonly field: "page" | "perPage",
    readonly reason: string,
  ) {
    super(`${field} ${reason}`);
  }
}

export class PaginationParams {
  static readonly DEFAULT_PAGE = 1 as const;
  static readonly DEFAULT_PER_PAGE = 20 as const;
  static readonly MAX_PER_PAGE = 100 as const;

  private constructor(
    readonly page: number,
    readonly perPage: number,
  ) {}

  static create(params: {
    readonly page?: string;
    readonly perPage?: string;
  }): PaginationParams {
    const page = PaginationParams.parsePositiveInteger(
      params.page,
      "page",
      PaginationParams.DEFAULT_PAGE,
    );
    const perPage = PaginationParams.parsePositiveInteger(
      params.perPage,
      "perPage",
      PaginationParams.DEFAULT_PER_PAGE,
    );

    if (perPage > PaginationParams.MAX_PER_PAGE) {
      throw new PaginationValidationError("perPage", "must not exceed 100");
    }

    return new PaginationParams(page, perPage);
  }

  get offset(): number {
    return (this.page - 1) * this.perPage;
  }

  private static parsePositiveInteger(
    value: string | undefined,
    field: "page" | "perPage",
    defaultValue: number,
  ): number {
    if (value === undefined) {
      return defaultValue;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new PaginationValidationError(field, "must be a positive integer");
    }

    return parsed;
  }
}
