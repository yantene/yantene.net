import { Hono } from "hono";
import { counterApp } from "./handlers/api/counter";
import { filesApp } from "./handlers/api/files";
import { adminFilesApp } from "./handlers/api/admin/files";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getApp = (
  handler: (
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ) => Promise<Response>,
) => {
  const app = new Hono<{ Bindings: Env }>()
    .get("/hello", (c) => c.text("Hello, World!"))
    .route("/api/counter", counterApp)
    .route("/api/files", filesApp)
    .route("/files", filesApp)
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

export type AppType = ReturnType<typeof getApp>;
