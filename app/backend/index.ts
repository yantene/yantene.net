import { Hono } from "hono";

export const getApp = (
  handler: (
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ) => Promise<Response>,
) => {
  const app = new Hono<{ Bindings: Env }>()
    .get("/hello", (c) => c.text("Hello, World!"))
    .all("*", async (context) => {
      return handler(
        context.req.raw,
        context.env,
        context.executionCtx as ExecutionContext,
      );
    });

  return app;
}
