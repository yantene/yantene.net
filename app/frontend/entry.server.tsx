import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { ServerRouter } from "react-router";
import type { AppLoadContext, EntryContext } from "react-router";
import { NonceContext } from "~/frontend/lib/nonce-context";
import { createI18nInstance } from "~/lib/i18n/init";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: AppLoadContext,
): Promise<Response> {
  const { nonce } = loadContext;
  const i18n = await createI18nInstance(resolveLocale(request));

  let isShellRendered = false;
  let statusCode = responseStatusCode;

  const body = await renderToReadableStream(
    <NonceContext.Provider value={nonce}>
      <I18nextProvider i18n={i18n}>
        <ServerRouter context={routerContext} url={request.url} nonce={nonce} />
      </I18nextProvider>
    </NonceContext.Provider>,
    {
      nonce,
      onError(error: unknown) {
        statusCode = 500;
        // シェル描画中のエラーは reject 側で報告されるため、ここでは
        // ストリーミング中に起きた分だけを記録する。
        if (isShellRendered) console.error(error);
      },
    },
  );
  isShellRendered = true;

  // クローラーには全内容が揃ってから返す (SSR で本文まで読ませる)。
  const userAgent = request.headers.get("user-agent");
  if ((userAgent !== null && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, { headers: responseHeaders, status: statusCode });
}
