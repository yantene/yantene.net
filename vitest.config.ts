import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig の paths (~/* → app/*) を解決する (Vite 8 のネイティブ機能)。
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
