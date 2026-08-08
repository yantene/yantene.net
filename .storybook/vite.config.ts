import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // tsconfig の paths (~/* → app/*) を解決する (Vite 8 のネイティブ機能)。
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss()],
});
