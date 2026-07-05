import { Head, Link } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import type { PageProps } from "~/frontend/page-props";
import { Header } from "~/frontend/components/layout/header";
import { Pagination } from "~/frontend/components/pagination/pagination";
import { AppLayout } from "~/frontend/layouts/app-layout";

interface PublicNote {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly imageUrl: string | null;
  readonly publishedOn: string;
  readonly lastModifiedOn: string;
}

interface NotesIndexProps extends PageProps {
  readonly notes: readonly PublicNote[];
  readonly pagination: {
    readonly page: number;
    readonly perPage: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

function hrefForPage(page: number): string {
  return page <= 1 ? "/notes" : `/notes?page=${String(page)}`;
}

export default function NotesIndex({
  notes,
  pagination,
}: NotesIndexProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Head title={t("notes.title")} />
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold">{t("notes.heading")}</h1>

        {notes.length === 0 ? (
          <p className="mt-8 text-base-content/60">{t("notes.empty")}</p>
        ) : (
          <ul className="mt-8 flex flex-col gap-4">
            {notes.map((note) => (
              <li key={note.slug}>
                <Link
                  href={`/notes/${note.slug}`}
                  className="card card-side bg-base-200 shadow-sm transition-shadow hover:shadow-md"
                >
                  {note.imageUrl !== null && (
                    <figure className="w-32 shrink-0">
                      <img
                        src={note.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </figure>
                  )}
                  <div className="card-body">
                    <h2 className="card-title">{note.title}</h2>
                    <time
                      dateTime={note.publishedOn}
                      className="text-sm text-base-content/60"
                    >
                      {note.publishedOn}
                    </time>
                    <p className="line-clamp-2 text-base-content/80">
                      {note.summary}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex justify-center">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            hrefForPage={hrefForPage}
          />
        </div>
      </main>
    </AppLayout>
  );
}
