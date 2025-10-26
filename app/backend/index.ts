import { Hono } from "hono";
import { apiApp } from "./handlers/api";
import { errorHandler } from "./handlers/error-handler";

export const app = new Hono<{ Bindings: Env }>()
  .route("/api", apiApp)
  .onError(errorHandler);

export const getApp = (
  handler: (
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ) => Promise<Response>,
) => {
  app.all("*", async (context) => {
    return handler(
      context.req.raw,
      context.env,
      context.executionCtx as ExecutionContext,
    );
  });

  return app;
};
