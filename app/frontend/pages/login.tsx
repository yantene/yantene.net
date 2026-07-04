import { Head } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import type { PageProps } from "~/frontend/page-props";
import { AppLayout } from "~/frontend/layouts/app-layout";

interface LoginProps extends PageProps {
  readonly error: string | null;
}

export default function Login({ error }: LoginProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Head title={t("login.heading")} />
      <main className="flex min-h-screen items-center justify-center">
        <div className="card w-full max-w-sm bg-base-200 shadow">
          <div className="card-body">
            <h1 className="card-title text-2xl">{t("login.heading")}</h1>
            <p className="text-sm text-base-content/60">
              {t("login.description")}
            </p>
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
