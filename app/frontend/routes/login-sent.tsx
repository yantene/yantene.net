import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Route } from "./+types/login-sent";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

export function loader({ request }: Route.LoaderArgs): PageMetaBase {
  return {
    locale: resolveLocale(request),
    origin: new URL(request.url).origin,
  };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin } = loaderData;
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: translationsFor(locale).loginSent.heading,
  });
};

export default function LoginSent(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <main className="flex min-h-screen items-center justify-center">
        <div className="card w-full max-w-md bg-base-200 shadow">
          <div className="card-body text-center">
            <h1 className="card-title justify-center text-2xl">
              {t("loginSent.heading")}
            </h1>
            <p className="text-base-content/60">{t("loginSent.description")}</p>
            <Link to="/login" className="link mt-4">
              {t("loginSent.backToLogin")}
            </Link>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
