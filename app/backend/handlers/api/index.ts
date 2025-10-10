import { Hono } from "hono";
import { apiV1App } from "./v1";

export const apiApp = new Hono<{ Bindings: Env }>().route("/v1", apiV1App);
