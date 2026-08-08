import { createRequestHandler, RouterContextProvider } from "react-router";
import { getApp } from "~/backend";
import { cloudflareContext, nonceContext } from "~/frontend/lib/route-context";

const requestHandler = createRequestHandler(
  async () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const app = getApp(async (request, env, ctx, nonce) => {
  // future.v8_middleware 有効時、loader へ渡すのは RouterContextProvider。
  // Worker のランタイム値はコンテキストキー経由で受け渡す (route-context.ts)。
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env, ctx });
  context.set(nonceContext, nonce);
  return requestHandler(request, context);
});

export default {
  fetch: app.fetch.bind(app),
} satisfies ExportedHandler<Env>;
