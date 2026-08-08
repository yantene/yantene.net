import { useTranslation } from "react-i18next";
import type { Route } from "./+types/login";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

export function loader({
  request,
}: Route.LoaderArgs): PageMetaBase & { error: string | null } {
  const url = new URL(request.url);
  return {
    // 認証フローからのリダイレクトで ?error=... が付く (Hono 側が付与する)。
    error: url.searchParams.get("error"),
    locale: resolveLocale(request),
    origin: url.origin,
  };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const { locale, origin } = loaderData;
  return buildPageMeta({
    locale,
    origin,
    title: translationsFor(locale).login.heading,
  });
};

export default function Login({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { error } = loaderData;

  return (
    <AppLayout>
      <main className="flex min-h-screen items-center justify-center">
        <div className="card w-full max-w-sm bg-base-200 shadow">
          <div className="card-body">
            <h1 className="card-title text-2xl">{t("login.heading")}</h1>
            <p className="text-sm text-base-content/60">
              {t("login.description")}
            </p>
            {/* 送信先は Hono 側のハンドラ (React Router のルートではない)。 */}
            <form method="post" action="/auth/magic-link" className="mt-4">
              <label className="form-control" htmlFor="email">
                <span className="label-text">{t("login.email")}</span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="input input-bordered mt-1 w-full"
                  placeholder="you@example.com"
                />
              </label>
              <button type="submit" className="btn btn-primary mt-4 w-full">
                {t("login.submit")}
              </button>
            </form>
            {error !== null && (
              <p className="mt-4 text-sm text-error" role="alert">
                {t(`login.errors.${error}`, {
                  defaultValue: t("login.errors.generic"),
                })}
              </p>
            )}
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
