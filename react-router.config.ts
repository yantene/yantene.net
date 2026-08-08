import type { Config } from "@react-router/dev/config";

export default {
  // フロントエンドは app/frontend 配下に置く (app/ 直下は backend/frontend/lib の
  // 三分割で、React Router のアプリディレクトリはそのうちの frontend のみ)。
  appDirectory: "app/frontend",
  ssr: true,
  // v7 では future フラグだった項目のうち、v8 で既定の挙動になったものは指定しない
  // (middleware / passThroughRequests / trailingSlashAwareDataRequests /
  //  viteEnvironmentApi)。splitRouteModules だけがトップレベル設定に昇格した。
  splitRouteModules: true,
} satisfies Config;
