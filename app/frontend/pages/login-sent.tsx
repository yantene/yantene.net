import { Head, Link } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import type { PageProps } from "~/frontend/page-props";
import { AppLayout } from "~/frontend/layouts/app-layout";

type LoginSentProps = PageProps;

export default function LoginSent(_props: LoginSentProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Head title={t("loginSent.heading")} />
      <main className="flex min-h-screen items-center justify-center">
        <div className="card w-full max-w-md bg-base-200 shadow">
          <div className="card-body text-center">
            <h1 className="card-title justify-center text-2xl">
              {t("loginSent.heading")}
            </h1>
            <p className="text-base-content/60">{t("loginSent.description")}</p>
            <Link href="/login" className="link mt-4">
              {t("loginSent.backToLogin")}
            </Link>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
