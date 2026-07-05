import { Head, Link } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "~/frontend/layouts/app-layout";

export default function Home(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Head title={t("home.heading")} />
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold">{t("home.heading")}</h1>
          <p className="mt-4 text-base-content/60">{t("home.tagline")}</p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/notes" className="btn btn-primary">
              {t("home.viewNotes")}
            </Link>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
