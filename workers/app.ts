import { createRequestHandler, RouterContextProvider } from "react-router";
import { getApp } from "~/backend";
import { handleRefreshQueue } from "~/backend/handlers/articles/refresh-queue.handler";
import {
  cloudflareContext,
  localeRouteContext,
  nonceRouteContext,
} from "~/frontend/lib/route-context";
import { resolveLocaleOrDefault } from "~/lib/i18n/resolve-locale";

const requestHandler = createRequestHandler(
  async () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const app = getApp(async (request, env, ctx, nonce) => {
  // React Router v8 では loader へ渡すのは RouterContextProvider。
  // Worker のランタイム値はコンテキストキー経由で受け渡す (route-context.ts)。
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env, ctx });
  context.set(nonceRouteContext, nonce);
  // ロケールはここで 1 回だけ決める。loader も entry.server もこの値を読む (#313)。
  context.set(localeRouteContext, resolveLocaleOrDefault(request));
  return requestHandler(request, context);
});

export default {
  fetch: app.fetch.bind(app),
  // コンテンツリポジトリへの push を受けて同期する (Artifacts の event subscription → Queue)。
  queue: handleRefreshQueue,
} satisfies ExportedHandler<Env>;
