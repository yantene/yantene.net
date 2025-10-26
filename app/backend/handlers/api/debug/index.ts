import { Hono } from "hono";
import { errorLogApp } from "./error-logs";

export const debugApp = new Hono<{ Bindings: Env }>().route(
  "/error-logs",
  errorLogApp,
);
