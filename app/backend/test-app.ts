import { getApp } from "~/backend/index";

/**
 * テスト用の Hono アプリを組み立てる。
 *
 * 本番では最後の `app.all("*")` が React Router のリクエストハンドラへ委譲するが、
 * バックエンドのテストで検証したいのは Hono 側 (API・フィード・BASIC 認証・
 * ルーティングの優先順位) なので、委譲先はページを描画しないダミーにする。
 * 「Hono が応答せず React Router へ落ちた」場合は 404 として観測できる。
 */
export function createTestApp(): ReturnType<typeof getApp> {
  return getApp(() => Promise.resolve(new Response("Not Found", { status: 404 })));
}
