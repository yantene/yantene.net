import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
    // tsconfig の paths (~/* → app/*) を解決する。Vite 8 の resolve.tsconfigPaths は
    // React Router v7 がまだ噛み合わないため、プラグイン側で解決する。
    tsconfigPaths(),
  ],
});
