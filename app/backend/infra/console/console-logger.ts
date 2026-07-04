import type {
  ILogger,
  LogContext,
} from "~/backend/domain/shared/logger.interface";

export class ConsoleLogger implements ILogger {
  constructor(private readonly baseContext: LogContext = {}) {}

  debug(message: string, context?: LogContext): void {
    console.debug(JSON.stringify({ ...this.baseContext, ...context, message }));
  }

  info(message: string, context?: LogContext): void {
    console.info(JSON.stringify({ ...this.baseContext, ...context, message }));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(JSON.stringify({ ...this.baseContext, ...context, message }));
  }

  error(message: string, context?: LogContext): void {
    console.error(JSON.stringify({ ...this.baseContext, ...context, message }));
  }

  child(context: LogContext): ILogger {
    return new ConsoleLogger({ ...this.baseContext, ...context });
  }
}
