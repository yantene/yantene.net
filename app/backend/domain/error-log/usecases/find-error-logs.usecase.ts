import type { IPersisted } from "../../persisted.interface";
import type { ErrorLog } from "../error-log.entity";
import type { IErrorLogQueryRepository } from "../error-log.query-repository.interface";

export interface IFindErrorLogsUsecase {
  execute(params: { limit?: number; offset?: number }): Promise<{
    logs: ErrorLog<IPersisted>[];
    total: number;
  }>;
}

export class FindErrorLogsUsecase implements IFindErrorLogsUsecase {
  constructor(
    private readonly errorLogQueryRepository: IErrorLogQueryRepository,
  ) {}

  async execute(params: { limit?: number; offset?: number }): Promise<{
    logs: ErrorLog<IPersisted>[];
    total: number;
  }> {
    const [logs, total] = await Promise.all([
      this.errorLogQueryRepository.findAll({
        limit: params.limit,
        offset: params.offset,
      }),
      this.errorLogQueryRepository.count(),
    ]);

    return { logs, total };
  }
}
