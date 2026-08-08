import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
// Vite の native config loader は実ファイルを解決するため、拡張子まで書く。
import { svgrPlugin } from "../vite.config.ts";

export default defineConfig({
  // tsconfig の paths (~/* → app/*) を解決する (Vite 8 のネイティブ機能)。
  resolve: {
    tsconfigPaths: true,
  },
  // svgr の設定は本体の vite.config.ts と共有する (食い違うと Storybook でだけ
  // SVG の見え方が変わるため)。
  plugins: [tailwindcss(), svgrPlugin()],
});
