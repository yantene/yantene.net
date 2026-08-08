import type { Config } from "@react-router/dev/config";

export default {
  // フロントエンドは app/frontend 配下に置く (app/ 直下は backend/frontend/lib の
  // 三分割で、React Router のアプリディレクトリはそのうちの frontend のみ)。
  appDirectory: "app/frontend",
  ssr: true,
  future: {
    // Vite Environment API を使い、@cloudflare/vite-plugin が作る "ssr" 環境と
    // ビルド出力を揃える。無効だと SSR ビルドがマニフェストを見つけられず落ちる。
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
