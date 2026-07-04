import { basicAuth } from "hono/basic-auth";
import type { MiddlewareHandler } from "hono";

export const conditionalBasicAuth: MiddlewareHandler = async (
  context,
  next,
) => {
  const env = context.env as Record<string, unknown>;
  const user = env.BASIC_AUTH_USER;
  const pass = env.BASIC_AUTH_PASS;

  if (typeof user === "string" && typeof pass === "string") {
    const middleware = basicAuth({ username: user, password: pass });
    await middleware(context, next);
    return;
  }

  await next();
};
