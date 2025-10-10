import { Hono } from "hono";

export const apiV1App = new Hono<{ Bindings: Env }>().get("/message", (c) =>
  c.json({ message: `Hello Hono from ${c.env.APP_ENV}!` }),
);
