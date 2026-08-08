import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // tsconfig の paths (~/* → app/*) を解決する (vite.config.ts と同じ理由)。
  plugins: [tailwindcss(), tsconfigPaths()],
});
