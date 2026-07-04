import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "happy-dom",
    include: ["app/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
