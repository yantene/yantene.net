import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type PluginOption } from "vite";
import svgr from "vite-plugin-svgr";

/**
 * SVG を React コンポーネントとしてインライン展開する (`import X from "./x.svg?react"`)。
 *
 * `<img src>` ではなくインライン展開する理由は 2 つ。外部 SVG には文書のスタイルが
 * 届かないため、街並みの `currentColor` が効かず、歩行者のパーツを CSS で回すこともできない。
 *
 * Storybook 側の vite 設定 (`.storybook/vite.config.ts`) からも参照する。設定が
 * 食い違うと Storybook でだけ SVG の見え方が変わるため、定義はここ 1 か所に置く。
 */
export function svgrPlugin(): PluginOption {
  return svgr({
    svgrOptions: {
      svgoConfig: {
        plugins: [
          {
            name: "preset-default",
            params: {
              overrides: {
                // 歩行者のパーツ (#leg-front など) を CSS が id で名指しする。
                // cleanupIds に潰されるとアニメーションが丸ごと効かなくなる。
                cleanupIds: false,
                // viewBox は素材を差し替えるときの契約なので消させない。
                removeViewBox: false,
              },
            },
          },
        ],
      },
    },
  });
}

export default defineConfig({
  // tsconfig の paths (~/* → app/*) を Vite に解決させる (Vite 8 のネイティブ機能)。
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    svgrPlugin(),
    reactRouter(),
  ],
});
