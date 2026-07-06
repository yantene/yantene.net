import { Head, Link } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import type { PageProps } from "~/frontend/page-props";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { NoteCard } from "~/frontend/components/note-card/note-card";
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
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
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => (
              <NoteCard key={note.slug} {...note} />
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            hrefForPage={hrefForPage}
          />
        </div>
      </main>
      <Footer />
    </AppLayout>
  );
}
