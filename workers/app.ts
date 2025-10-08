import { createRequestHandler } from "react-router";
import { getApp } from "server";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

const app = getApp(async (request, env, ctx) => {
  return requestHandler(request, {
    cloudflare: { env, ctx },
  });
});

export default app satisfies ExportedHandler<Env>;
