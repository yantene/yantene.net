import { drizzle } from "drizzle-orm/d1";
import type { Context, ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { RecordErrorUsecase } from "../domain/error-log/usecases/record-error.usecase";
import { ErrorLogCommandRepository } from "../infra/d1/error-log/error-log.command-repository";

export const errorHandler: ErrorHandler<{ Bindings: Env }> = async (err, c) => {
  await recordErrorLog(err, c).catch((logError) => {
    // 無限ループ防止のため、記録失敗時はコンソール出力のみ
    console.error("Failed to record error log:", logError);
  });

  return buildErrorResponse(err, c);
};

async function recordErrorLog(err: Error, c: Context<{ Bindings: Env }>) {
  const db = drizzle(c.env.D1);
  const errorLogRepo = new ErrorLogCommandRepository(db);
  const recordErrorUsecase = new RecordErrorUsecase(errorLogRepo);

  await recordErrorUsecase.execute({
    error: err,
    context: {
      path: c.req.path,
      method: c.req.method,
    },
  });
}

function buildErrorResponse(err: Error, c: Context<{ Bindings: Env }>) {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  return c.json({ error: "Internal Server Error" }, 500);
}
