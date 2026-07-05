import { renderToString } from "react-dom/server";
import {
  Link,
  ReactRefresh,
  Script,
  ViteClient,
} from "vite-ssr-components/react";
import type { RootView } from "@hono/inertia";
import { renderPage } from "~/frontend/entry.server";
import { isSupportedLocale, type SupportedLocale } from "~/lib/i18n/locale";
import resources from "~/lib/i18n/locales";

interface HeadProps {
  readonly title: string;
  readonly description: string;
}

function Head({ title, description }: HeadProps): React.JSX.Element {
  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <ViteClient />
      <ReactRefresh />
      <Link href="/app/frontend/app.css" rel="stylesheet" />
      <Script src="/app/frontend/entry.client.tsx" />
    </>
  );
}

function resolveLocale(page: {
  props: Record<string, unknown>;
}): SupportedLocale {
  const value = page.props.locale;
  return typeof value === "string" && isSupportedLocale(value) ? value : "en";
}

export const rootView: RootView = async (page) => {
  const locale = resolveLocale(page);
  // eslint-disable-next-line security/detect-object-injection -- locale is narrowed to SupportedLocale literal
  const translations = resources[locale].translation;
  const { meta } = translations;

  const { head, body } = await renderPage(page);
  const headHtml =
    renderToString(<Head title={meta.title} description={meta.description} />) +
    head.join("");

  // body には Inertia の SSR 出力 (<script data-page="app"> + <div id="app">) が
  // すでに含まれている。ここで <div id="app"> を重ねて巻くと id が重複し、
  // hydration 対象がずれる・data-page 属性が壊れるため、body をそのまま配置する。
  // テーマは light 固定 (ダークモード不採用)。
  return `<!DOCTYPE html>
<html lang="${locale}" data-theme="light">
  <head>
    ${headHtml}
  </head>
  <body>
    ${body}
  </body>
</html>`;
};
