import { Hono } from "hono";
import { adminFilesApp } from "./handlers/api/admin/files";
import { filesApp } from "./handlers/api/files";

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const getApp = (
  handler: (
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ) => Promise<Response>,
) => {
  const app = new Hono<{ Bindings: Env }>()
    .get("/hello", (c) => c.text("Hello, World!"))
    .route("/api/files", filesApp)
    .route("/api/admin/files", adminFilesApp)
    .all("*", async (context) => {
      return handler(
        context.req.raw,
        context.env,
        context.executionCtx as ExecutionContext,
      );
    });

  return app;
};
/* eslint-enable @typescript-eslint/explicit-function-return-type */

export type AppType = ReturnType<typeof getApp>;
