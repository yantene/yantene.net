import { Hono } from "hono";
import { debugApp } from "./debug";
import { apiV1App } from "./v1";

export const apiApp = new Hono<{ Bindings: Env }>()
  .route("/v1", apiV1App)
  .route("/debug", debugApp);
