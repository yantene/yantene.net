import { Head, Link } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import type { PageProps } from "~/frontend/page-props";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { NoteCard } from "~/frontend/components/note-card/note-card";
import { AppLayout } from "~/frontend/layouts/app-layout";

interface NoteMeta {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly imageUrl: string | null;
  readonly tags: readonly string[];
  readonly publishedOn: string;
}

interface SeriesShowProps extends PageProps {
  readonly name: string | null;
  readonly notes: readonly NoteMeta[];
}

export default function SeriesShow({
  name,
  notes,
}: SeriesShowProps): React.JSX.Element {
  const { t } = useTranslation();

  if (name === null) {
    return (
      <AppLayout>
        <Head title={t("series.notFound.title")} />
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-center">
          <h1 className="text-3xl font-bold">{t("series.notFound.heading")}</h1>
          <Link href="/notes" className="btn btn-primary mt-8">
            {t("notes.notFound.backToList")}
          </Link>
        </main>
        <Footer />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Head title={name} />
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <p className="text-sm font-medium text-accent-content">
          {t("series.label")}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{name}</h1>
        <p className="mt-2 text-sm text-base-content/60">
          {t("series.count", { count: notes.length })}
        </p>
        <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <li key={note.slug}>
              <NoteCard {...note} />
            </li>
          ))}
        </ol>
      </main>
      <Footer />
    </AppLayout>
  );
}
