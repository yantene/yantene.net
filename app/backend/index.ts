import { Hono } from "hono";
import { notesApp } from "./handlers/api/v1/notes";

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
    .route("/api/v1/notes", notesApp)
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
