import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./app/backend/infra/d1/schema.ts",
  out: "./migrations",
  driver: "d1-http",
});
