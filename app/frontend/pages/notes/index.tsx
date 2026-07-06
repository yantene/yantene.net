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
  readonly tags: readonly string[];
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
  /** 絞り込み中のタグ (未絞り込みなら null)。 */
  readonly tag: string | null;
  readonly sort: {
    readonly sortBy: string | null;
    readonly order: string | null;
  };
}

const DEFAULT_PER_PAGE = 20;

/**
 * ページ送りリンクの URL を組み立てる。現在の per-page / sort-by / order を保持し、
 * 既定値は省略して URL をきれいに保つ。
 */
function buildHrefForPage(
  page: number,
  perPage: number,
  sort: NotesIndexProps["sort"],
  tag: string | null,
): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (perPage !== DEFAULT_PER_PAGE) params.set("per-page", String(perPage));
  if (sort.sortBy !== null) params.set("sort-by", sort.sortBy);
  if (sort.order !== null) params.set("order", sort.order);
  if (tag !== null) params.set("tag", tag);
  const query = params.toString();
  return query.length > 0 ? `/notes?${query}` : "/notes";
}

export default function NotesIndex({
  notes,
  pagination,
  tag,
  sort,
}: NotesIndexProps): React.JSX.Element {
  const { t } = useTranslation();
  const hrefForPage = (page: number): string =>
    buildHrefForPage(page, pagination.perPage, sort, tag);

  return (
    <AppLayout>
      <Head title={t("notes.title")} />
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-3xl font-bold">{t("notes.heading")}</h1>
          {tag !== null && (
            <span className="text-base-content/70">
              {t("notes.filteredByTag", { tag })}
              <Link href="/notes" className="link link-primary ml-2 text-sm">
                {t("notes.clearFilter")}
              </Link>
            </span>
          )}
        </div>

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
                    {note.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {note.tags.map((tg) => (
                          <span key={tg} className="badge badge-sm badge-ghost">
                            {tg}
                          </span>
                        ))}
                      </div>
                    )}
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
