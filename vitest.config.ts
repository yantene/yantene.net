import { defineConfig } from "vitest/config";
// Vite の native config loader は実ファイルを解決するため、拡張子まで書く。
import { svgrPlugin } from "./vite.config.ts";

export default defineConfig({
  // tsconfig の paths (~/* → app/*) を解決する (Vite 8 のネイティブ機能)。
  resolve: {
    tsconfigPaths: true,
  },
  // テストが描画するコンポーネントも SVG を ?react で読むため、本体と同じ svgr を通す。
  plugins: [svgrPlugin()],
  test: {
    environment: "happy-dom",
    include: ["app/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
