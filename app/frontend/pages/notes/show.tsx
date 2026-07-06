import { Head, Link } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import type { Root as MdastRoot } from "mdast";
import type { PageProps } from "~/frontend/page-props";
import { Header } from "~/frontend/components/layout/header";
import { MdastRenderer } from "~/frontend/components/mdast/mdast-renderer";
import { AppLayout } from "~/frontend/layouts/app-layout";

interface NoteMeta {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly imageUrl: string | null;
  readonly tags: readonly string[];
  readonly publishedOn: string;
  readonly lastModifiedOn: string;
}

interface NoteShowProps extends PageProps {
  readonly note: NoteMeta | null;
  readonly mdast: MdastRoot | null;
}

export default function NoteShow({
  note,
  mdast,
}: NoteShowProps): React.JSX.Element {
  const { t } = useTranslation();

  if (note === null || mdast === null) {
    return (
      <AppLayout>
        <Head title={t("notes.notFound.title")} />
        <Header />
        <main className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h1 className="text-3xl font-bold">{t("notes.notFound.heading")}</h1>
          <p className="mt-4 text-base-content/60">
            {t("notes.notFound.description")}
          </p>
          <Link href="/notes" className="btn btn-primary mt-8">
            {t("notes.notFound.backToList")}
          </Link>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Head title={note.title}>
        <meta name="description" content={note.summary} />
      </Head>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-4xl font-bold">{note.title}</h1>
          <time
            dateTime={note.publishedOn}
            className="mt-2 block text-sm text-base-content/60"
          >
            {note.publishedOn}
          </time>
          {note.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {note.tags.map((tg) => (
                <Link
                  key={tg}
                  href={`/notes?tag=${encodeURIComponent(tg)}`}
                  className="badge badge-outline gap-1 hover:badge-primary"
                >
                  {tg}
                </Link>
              ))}
            </div>
          )}
          {note.imageUrl !== null && (
            <img
              src={note.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="mt-6 w-full rounded-lg object-cover"
            />
          )}
        </header>
        <MdastRenderer node={mdast} />
      </main>
    </AppLayout>
  );
}
