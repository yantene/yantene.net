import { useContext } from "react";
import { useTranslation } from "react-i18next";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import { NonceContext } from "~/frontend/lib/nonce-context";
import { buildPageMeta } from "~/frontend/lib/page-meta";
import { resolveLocale } from "~/lib/i18n/resolve-locale";
import "./app.css";

export function loader({ request }: Route.LoaderArgs): {
  locale: string;
  origin: string;
} {
  return {
    locale: resolveLocale(request),
    // OGP は絶対 URL を要求するため、リクエストの origin を各ページの meta へ渡す。
    origin: new URL(request.url).origin,
  };
}

/**
 * サイト既定の OGP / Twitter Card。個別ページは meta を上書きして
 * 記事タイトル・要約・OG 画像を差し替える。
 */
export const meta: Route.MetaFunction = ({ loaderData }) =>
  buildPageMeta({
    locale: loaderData?.locale ?? "en",
    origin: loaderData?.origin ?? "",
  });

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/icons/icon.svg" },
  { rel: "manifest", href: "/manifest.webmanifest" },
  {
    rel: "alternate",
    type: "application/atom+xml",
    title: "yantene.net",
    href: "/feed.xml",
  },
];

export function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const { i18n } = useTranslation();
  const nonce = useContext(NonceContext);

  // テーマは light 固定 (ダークモード不採用)。
  return (
    <html lang={i18n.language} data-theme="yantene">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="csp-nonce" content={nonce} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        {/* ハッシュ付き URL・戻る/進むのスクロール位置を React Router に復元させる。 */}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App(): React.JSX.Element {
  return <Outlet />;
}

export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps): React.JSX.Element {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const heading = isNotFound ? "404" : "Error";
  const detail = isNotFound
    ? "The requested page could not be found."
    : "An unexpected error occurred.";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-center">
      <h1 className="text-3xl font-bold">{heading}</h1>
      <p className="mt-4 text-base-content/60">{detail}</p>
    </main>
  );
}
