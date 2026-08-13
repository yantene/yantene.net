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
import { feedIdentity } from "~/lib/feed";
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
export const meta: Route.MetaFunction = ({ loaderData, location }) =>
  buildPageMeta({
    locale: loaderData?.locale ?? "en",
    origin: loaderData?.origin ?? "",
    pathname: location.pathname,
  });

/**
 * Google Fonts から読む 2 つ (ADR 0017)。
 *
 * - Noto Sans JP — 本文。読み手の OS で字面が変わらないように揃える
 * - STIX Two Math — 数式。MATH テーブルを持つので大型演算子と根号が式に合わせて伸びる
 *
 * `display=swap` にしてあるので、届くまではシステムのフォントで出る。日本語は字幅が
 * 変わるため差し替わりが目に見えるが、字が出ないまま待たせるよりはよい。
 *
 * CSP の許可と対で動く (`app/backend/index.ts`)。ここのホストを変えるならあちらも直すこと。
 */
const googleFontFamilies = [
  // 本文。400 は地の文、700 は見出しと強調。
  { name: "Noto Sans JP", weights: [400, 700] },
  // 数式。ウェイトは 1 つしか無いので指定しない。
  { name: "STIX Two Math", weights: [] },
] as const satisfies readonly {
  name: string;
  weights: readonly number[];
}[];

/* 組み立ててあるのは、読む先を素の名前で並べておくため (URL を 1 本の文字列で持つと
 * どの字を読んでいるのか読み取りにくく、lint も高エントロピー文字列として弾く)。 */
const GOOGLE_FONTS_HREF = `https://fonts.googleapis.com/css2?${googleFontFamilies
  .map(({ name, weights }) => {
    const family = `family=${name.replaceAll(" ", "+")}`;
    return weights.length === 0
      ? family
      : `${family}:wght@${weights.join(";")}`;
  })
  .join("&")}&display=swap`;

export const links: Route.LinksFunction = () => [
  // フォント本体は CSS を読んでから要求が始まるので、先に両方へ繋いでおく。
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous" as const,
  },
  { rel: "stylesheet", href: GOOGLE_FONTS_HREF },
  { rel: "icon", type: "image/svg+xml", href: "/icons/icon.svg" },
  // SVG を読めない相手のために、素の favicon も置いておく。
  { rel: "icon", type: "image/x-icon", href: "/favicon.ico", sizes: "48x48" },
  // iOS はホーム画面に置くときに manifest ではなくこれを見る。
  { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
  { rel: "manifest", href: "/manifest.webmanifest" },
  // 名乗りは feedIdentity から引く。ここで文字列を持つと、リーダーに見える名前と
  // フィード本体の <title> がずれる。
  {
    rel: "alternate",
    type: "application/atom+xml",
    title: feedIdentity(null).title,
    href: feedIdentity(null).path,
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
