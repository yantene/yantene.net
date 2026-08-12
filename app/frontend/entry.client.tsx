import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { HydratedRouter } from "react-router/dom";
import { enableActiveOnTouch } from "~/frontend/lib/enable-active-on-touch";
import { NonceContext } from "~/frontend/lib/nonce-context";
import { registerServiceWorker } from "~/frontend/lib/register-service-worker";
import { initI18nGlobal } from "~/lib/i18n/init";

const locale =
  document.documentElement.lang.length > 0
    ? document.documentElement.lang
    : "en";

const nonce =
  document.querySelector('meta[name="csp-nonce"]')?.getAttribute("content") ??
  "";

const i18n = await initI18nGlobal(locale);

// 押下の反応が iOS でも出るようにする。描画の前に置くのは、最初の 1 タップから効かせるため。
enableActiveOnTouch();

startTransition(() => {
  hydrateRoot(
    document,
    <NonceContext.Provider value={nonce}>
      <I18nextProvider i18n={i18n}>
        <StrictMode>
          {/*
            HydratedRouter は nonce を prop に取らない (SSR 側の <ServerRouter nonce> が
            出力済みの nonce をブラウザが保持する)。nonce は NonceContext 経由で
            root.tsx の <Scripts> / <ScrollRestoration> に渡す。
          */}
          <HydratedRouter />
        </StrictMode>
      </I18nextProvider>
    </NonceContext.Provider>,
  );
});

// 一度読んだページを電波の無い場所でも開けるようにする (#123)。描画には関わらないので
// hydrate のあとに回す。
registerServiceWorker();
