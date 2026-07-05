import { Head, Link, router } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import type { PageProps } from "~/frontend/page-props";
import { AppLayout } from "~/frontend/layouts/app-layout";

interface HomeProps extends PageProps {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
  };
}

export default function Home({ user }: HomeProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Head title={t("home.heading")} />
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold">
            {t("home.welcome", { name: user.displayName })}
          </h1>
          <p className="mt-4 text-base-content/60">{user.email}</p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/notes" className="btn btn-primary">
              {t("home.viewNotes")}
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                router.post("/auth/logout");
              }}
            >
              {t("home.logout")}
            </button>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
