export interface LogContext {
  readonly [key: string]: unknown;
}

export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): ILogger;
}

function causeToContext(cause: unknown): LogContext {
  if (cause instanceof Error) {
    return {
      errorCauseName: cause.name,
      errorCauseMessage: cause.message,
      errorCauseStack: cause.stack,
    };
  }
  return { errorCause: String(cause) };
}

export function errorToContext(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      ...(error.cause !== undefined && causeToContext(error.cause)),
    };
  }
  return { error: String(error) };
}
