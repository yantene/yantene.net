import { HTTPException } from "hono/http-exception";
import type { IErrorLogCommandRepository } from "../error-log.command-repository.interface";
import { ErrorLog } from "../error-log.entity";
import { LogLevel } from "../log-level.vo";

export class RecordErrorUsecase {
  constructor(
    private readonly errorLogRepository: IErrorLogCommandRepository,
  ) {}

  async execute(params: {
    error: Error;
    context: {
      path: string;
      method: string;
    };
  }): Promise<void> {
    // HTTPExceptionの場合は適切なログレベルを設定
    let level: LogLevel;
    let status: number;

    if (params.error instanceof HTTPException) {
      status = params.error.status;
      level =
        status >= 500 ? LogLevel.create("error") : LogLevel.create("warn");
    } else {
      status = 500;
      level = LogLevel.create("fatal");
    }

    const errorLog = ErrorLog.create({
      level,
      message: params.error.message,
      stack: params.error.stack,
      context: JSON.stringify({
        path: params.context.path,
        method: params.context.method,
        status,
      }),
    });

    await this.errorLogRepository.save(errorLog);
  }
}
