import { createInertiaApp, type ResolvedComponent } from "@inertiajs/react";
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { initI18nGlobal } from "~/lib/i18n/init";

type PageLoader = () => Promise<ResolvedComponent>;

const pages = import.meta.glob<ResolvedComponent>(
  "./pages/**/*.tsx",
) as Partial<Record<string, PageLoader>>;

void createInertiaApp({
  resolve: async (name): Promise<ResolvedComponent> => {
    const importer = pages[`./pages/${name}.tsx`];
    if (importer === undefined) {
      throw new Error(`Inertia page not found: ${name}`);
    }
    return importer();
  },
  setup({ el, App, props }) {
    const locale =
      document.documentElement.lang.length > 0
        ? document.documentElement.lang
        : "en";

    void (async () => {
      const i18n = await initI18nGlobal(locale);
      const tree = (
        <StrictMode>
          <I18nextProvider i18n={i18n}>
            <App {...props} />
          </I18nextProvider>
        </StrictMode>
      );

      if (el.hasChildNodes()) {
        hydrateRoot(el, tree);
      } else {
        createRoot(el).render(tree);
      }
    })();
  },
  // NProgress は inline <style> を動的注入するが、CSP の style-src は 'self' のみで
  // nonce も unsafe-inline も許可していないためブロックされる。secure-by-default を
  // 崩さないよう進捗バーは無効化する。
  progress: false,
});
