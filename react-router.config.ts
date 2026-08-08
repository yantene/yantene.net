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
    // クライアント側のルートエクスポートを分割チャンク化する (コード変更不要)。
    v8_splitRouteModules: true,
    // データリクエスト URL を末尾スラッシュ区別ありの `/_.data` 形式にする。
    v8_trailingSlashAwareDataRequests: true,
    // request.url を正規化せず生のまま渡す。正規化済み URL は loader の `url` 引数から取る。
    v8_passThroughRequests: true,
    // loader/action の前後に挟めるミドルウェアを有効化する。
    // これに伴い loader の `context` が RouterContextProvider になる。
    v8_middleware: true,
  },
} satisfies Config;
