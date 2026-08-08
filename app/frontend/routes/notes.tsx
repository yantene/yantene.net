import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Route } from "./+types/notes";
import type { NotesListPageData } from "~/backend/handlers/notes/pages.handler";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { loadNotesListPage } from "~/backend/handlers/notes/pages.handler";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { NoteCard } from "~/frontend/components/note-card/note-card";
import { Pagination } from "~/frontend/components/pagination/pagination";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

const DEFAULT_PER_PAGE = 20;

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & NotesListPageData> {
  const url = new URL(request.url);
  const data = await loadNotesListPage(context.cloudflare.env, url);
  return { ...data, locale: resolveLocale(request), origin: url.origin };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin } = loaderData;
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: translationsFor(locale).notes.title,
  });
};

/**
 * ページ送りリンクの URL を組み立てる。現在の per-page / sort-by / order を保持し、
 * 既定値は省略して URL をきれいに保つ。
 */
function buildHrefForPage(
  page: number,
  perPage: number,
  sort: { sortBy: string | null; order: string | null },
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
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { notes, pagination, tag, sort } = loaderData;
  const hrefForPage = (page: number): string =>
    buildHrefForPage(page, pagination.perPage, sort, tag);

  return (
    <AppLayout>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-3xl font-bold">{t("notes.heading")}</h1>
          {tag !== null && (
            <span className="text-base-content/70">
              {t("notes.filteredByTag", { tag })}
              <Link to="/notes" className="link link-primary ml-2 text-sm">
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
