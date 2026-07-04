import { createInertiaApp, type ResolvedComponent } from "@inertiajs/react";
import { renderToString } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import type { PageObject } from "@hono/inertia";
import type { Page } from "@inertiajs/core";
import { createI18nInstance } from "~/lib/i18n/init";
import { isSupportedLocale } from "~/lib/i18n/locale";

const pages = import.meta.glob<ResolvedComponent>("./pages/**/*.tsx", {
  eager: true,
}) as Partial<Record<string, ResolvedComponent>>;

export async function renderPage(
  page: PageObject,
): Promise<{ head: string[]; body: string }> {
  const localeProp = (page.props as { locale?: unknown }).locale;
  const locale =
    typeof localeProp === "string" && isSupportedLocale(localeProp)
      ? localeProp
      : "en";

  const instance = await createI18nInstance(locale);

  return createInertiaApp({
    page: page as Page,
    render: renderToString,
    resolve: (name) => {
      const mod = pages[`./pages/${name}.tsx`];
      if (mod === undefined) {
        throw new Error(`Inertia page not found: ${name}`);
      }
      return mod;
    },
    setup: ({ App, props }) => (
      <I18nextProvider i18n={instance}>
        <App {...props} />
      </I18nextProvider>
    ),
  });
}
