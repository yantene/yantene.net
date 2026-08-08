import { createRequestHandler } from "react-router";
import { getApp } from "~/backend";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    /** secureHeaders が発行した CSP nonce (script に付与する)。 */
    nonce: string;
  }
}

const requestHandler = createRequestHandler(
  async () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const app = getApp(async (request, env, ctx, nonce) =>
  requestHandler(request, { cloudflare: { env, ctx }, nonce }),
);

export default {
  fetch: app.fetch.bind(app),
} satisfies ExportedHandler<Env>;
