import { cloudflare } from "@cloudflare/vite-plugin";
import { inertiaPages } from "@hono/inertia/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import ssrPlugin from "vite-ssr-components/plugin";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    inertiaPages({
      pagesDir: "app/frontend/pages",
      outFile: "app/frontend/pages.gen.ts",
      serverModule: "~/backend",
    }),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    react(),
    ssrPlugin(),
  ],
});
