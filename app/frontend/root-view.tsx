import { renderToString } from "react-dom/server";
import {
  Link,
  ReactRefresh,
  Script,
  ViteClient,
} from "vite-ssr-components/react";
import type { RootView } from "@hono/inertia";
import { renderPage } from "~/frontend/entry.server";
import { renderJsonLd } from "~/frontend/json-ld";
import { isSupportedLocale, type SupportedLocale } from "~/lib/i18n/locale";
import resources from "~/lib/i18n/locales";

/** ページが props で渡す OGP メタ (省略時はサイト既定にフォールバック)。 */
interface PageOg {
  readonly title?: string;
  readonly description?: string;
  /** OG 画像の相対パス (例: "/og/notes/foo")。root-view で絶対 URL 化する。 */
  readonly image?: string;
  readonly type?: string;
}

interface OgValues {
  readonly title: string;
  readonly description: string;
  readonly image: string;
  readonly url: string;
  readonly type: string;
}

interface HeadProps {
  readonly title: string;
  readonly description: string;
  readonly og: OgValues;
}

function Head({ title, description, og }: HeadProps): React.JSX.Element {
  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <link
        rel="alternate"
        type="application/atom+xml"
        title="yantene.net"
        href="/feed.xml"
      />
      <link rel="canonical" href={og.url} />
      <meta property="og:site_name" content="yantene.net" />
      <meta property="og:locale" content="ja_JP" />
      <meta property="og:title" content={og.title} />
      <meta property="og:description" content={og.description} />
      <meta property="og:image" content={og.image} />
      <meta property="og:url" content={og.url} />
      <meta property="og:type" content={og.type} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={og.title} />
      <meta name="twitter:description" content={og.description} />
      <meta name="twitter:image" content={og.image} />
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

export const rootView: RootView = async (page, c) => {
  const locale = resolveLocale(page);
  // eslint-disable-next-line security/detect-object-injection -- locale is narrowed to SupportedLocale literal
  const translations = resources[locale].translation;
  const { meta } = translations;

  // OGP は絶対 URL が要る。リクエスト URL から origin/pathname を組む。
  const requestUrl = new URL(c.req.url);
  const pageOg = (page.props.og ?? {}) as PageOg;
  const og: OgValues = {
    title: pageOg.title ?? meta.title,
    description: pageOg.description ?? meta.description,
    image: `${requestUrl.origin}${pageOg.image ?? "/og/default"}`,
    url: `${requestUrl.origin}${requestUrl.pathname}`,
    type: pageOg.type ?? "website",
  };

  const jsonLdScript = renderJsonLd(page.props.jsonLd);

  const { head, body } = await renderPage(page);
  const headHtml =
    renderToString(
      <Head title={meta.title} description={meta.description} og={og} />,
    ) +
    head.join("") +
    jsonLdScript;

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
