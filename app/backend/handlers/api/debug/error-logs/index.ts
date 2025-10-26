import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { FindErrorLogsUsecase } from "../../../../domain/error-log/usecases/find-error-logs.usecase";
import { ErrorLogQueryRepository } from "../../../../infra/d1/error-log/error-log.query-repository";

export const errorLogApp = new Hono<{ Bindings: Env }>()
  .get("/", async (c) => {
    const db = drizzle(c.env.D1);
    const errorLogQueryRepo = new ErrorLogQueryRepository(db);
    const findErrorLogsUsecase = new FindErrorLogsUsecase(errorLogQueryRepo);

    const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
    const offset = Number(c.req.query("offset")) || 0;

    const result = await findErrorLogsUsecase.execute({ limit, offset });

    return c.json({
      data: result.logs.map((log) => log.toJSON()),
      pagination: {
        limit,
        offset,
        total: result.total,
      },
    });
  })
  .post("/400", () => {
    throw new HTTPException(400, { message: "Bad Request Test" });
  })
  .post("/500", () => {
    throw new HTTPException(500, { message: "Internal Server Error Test" });
  })
  .post("/throw", () => {
    throw new Error("Uncaught Error Test");
  });
