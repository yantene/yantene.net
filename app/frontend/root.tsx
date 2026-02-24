import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { httpStatus } from "~/lib/constants/http-status";
import { Footer } from "./components/layout/footer";
import { registerServiceWorker } from "./lib/pwa/register-sw";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    // eslint-disable-next-line no-secrets/no-secrets -- Google Fonts URL
    href: "https://fonts.googleapis.com/css2?family=M+PLUS+1:wght@100..900&display=swap",
  },
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "icon", type: "image/svg+xml", href: "/icons/icon.svg" },
  { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
];

export function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#3b6fd4" />
        <Meta />
        <Links />
      </head>
      <body className="font-light">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App(): React.JSX.Element {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps): React.JSX.Element {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === httpStatus.NOT_FOUND ? "404" : "Error";
    if (error.status === httpStatus.NOT_FOUND) {
      details = "The requested page could not be found.";
    } else if (error.statusText.length > 0) {
      details = error.statusText;
    }
  } else if (import.meta.env.DEV && error != null && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack != null && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
