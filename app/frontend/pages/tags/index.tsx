import { Head, Link } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import type { PageProps } from "~/frontend/page-props";
import { Header } from "~/frontend/components/layout/header";
import { AppLayout } from "~/frontend/layouts/app-layout";

interface TagCount {
  readonly tag: string;
  readonly count: number;
}

interface TagsIndexProps extends PageProps {
  readonly tags: readonly TagCount[];
}

export default function TagsIndex({ tags }: TagsIndexProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Head title={t("tags.title")} />
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold">{t("tags.heading")}</h1>

        {tags.length === 0 ? (
          <p className="mt-8 text-base-content/60">{t("tags.empty")}</p>
        ) : (
          <ul className="mt-8 flex flex-wrap gap-3">
            {tags.map(({ tag, count }) => (
              <li key={tag}>
                <Link
                  href={`/notes?tag=${encodeURIComponent(tag)}`}
                  className="badge badge-lg badge-outline gap-2 py-3 hover:badge-primary"
                >
                  <span>{tag}</span>
                  <span className="text-xs opacity-60">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppLayout>
  );
}
