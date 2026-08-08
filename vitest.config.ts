import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig の paths (~/* → app/*) を解決する。Vite 8 の resolve.tsconfigPaths は
  // React Router v7 と噛み合わないため、プラグイン側で解決する (vite.config.ts と同じ)。
  plugins: [tsconfigPaths()],
  test: {
    environment: "happy-dom",
    include: ["app/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
