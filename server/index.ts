import { Hono } from "hono";

const app = new Hono<{Bindings: Env}>();

app.get('/hono', (c) => {
  return c.text('Hello Hono!');
})

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