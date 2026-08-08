import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { HydratedRouter } from "react-router/dom";
import { NonceContext } from "~/frontend/lib/nonce-context";
import { initI18nGlobal } from "~/lib/i18n/init";

const locale =
  document.documentElement.lang.length > 0
    ? document.documentElement.lang
    : "en";

const nonce =
  document.querySelector('meta[name="csp-nonce"]')?.getAttribute("content") ??
  "";

const i18n = await initI18nGlobal(locale);

startTransition(() => {
  hydrateRoot(
    document,
    <NonceContext.Provider value={nonce}>
      <I18nextProvider i18n={i18n}>
        <StrictMode>
          <HydratedRouter />
        </StrictMode>
      </I18nextProvider>
    </NonceContext.Provider>,
  );
});
