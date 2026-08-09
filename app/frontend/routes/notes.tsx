import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Route } from "./+types/notes";
import type { NotesListPageData } from "~/backend/handlers/notes/pages.handler";
import type { LoadNotePage } from "~/frontend/components/note-timeline/infinite-note-timeline";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { loadNotesListPage } from "~/backend/handlers/notes/pages.handler";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { InfiniteNoteTimeline } from "~/frontend/components/note-timeline/infinite-note-timeline";
import { parseNoteListPayload } from "~/frontend/components/note-timeline/note-list-payload";
import { Pagination } from "~/frontend/components/pagination/pagination";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext } from "~/frontend/lib/route-context";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

const DEFAULT_PER_PAGE = 20;

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & NotesListPageData> {
  const url = new URL(request.url);
  const data = await loadNotesListPage(context.get(cloudflareContext).env, url);
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

interface SortState {
  readonly sortBy: string | null;
  readonly order: string | null;
}

/**
 * ページ送りリンクの URL を組み立てる。現在の per-page / sort-by / order を保持し、
 * 既定値は省略して URL をきれいに保つ。
 */
function buildHrefForPage(
  page: number,
  perPage: number,
  sort: SortState,
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

/**
 * 続きを取りに行く手を、いまの絞り込みと並び順に合わせて作る。
 *
 * 既定の取り方 (`/api/v1/notes` をそのまま叩く) では、タグで絞った一覧の 2 ページ目に
 * 絞り込みのない記事が混ざる。ここで同じ条件を引き継いだものを渡す。
 */
function buildLoadPage(sort: SortState, tag: string | null): LoadNotePage {
  return async (page, perPage) => {
    const params = new URLSearchParams({
      page: String(page),
      "per-page": String(perPage),
    });
    if (sort.sortBy !== null) params.set("sort-by", sort.sortBy);
    if (sort.order !== null) params.set("order", sort.order);
    if (tag !== null) params.set("tag", tag);

    const response = await fetch(`/api/v1/notes?${params.toString()}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`status ${String(response.status)}`);

    const payload = parseNoteListPayload(await response.json());
    if (payload === null) throw new Error("unexpected payload");
    return payload;
  };
}

export default function NotesIndex({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { notes, pagination, tag, sort } = loaderData;
  const hrefForPage = (page: number): string =>
    buildHrefForPage(page, pagination.perPage, sort, tag);
  /*
   * 取り方は毎描画で作り直さない。
   *
   * 依存に sort をそのまま置くと、loader が返す度に別のオブジェクトになるため毎描画で
   * 作り直しになる。その度に下端の見張りが張り替えられ、観測が呼ばれる前に外れて、
   * 続きが永久に読まれない。中身のプリミティブに依存させる。
   */
  const { sortBy, order } = sort;
  const loadPage = useMemo(
    () => buildLoadPage({ sortBy, order }, tag),
    [sortBy, order, tag],
  );
  // 年で束ねられるのは公開日で並んでいるときだけ。更新日順では公開年が前後してしまう。
  const isGroupByYear = sort.sortBy === null || sort.sortBy === "published";

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
          <div className="mt-8">
            <InfiniteNoteTimeline
              initialNotes={notes}
              totalPages={pagination.totalPages}
              perPage={pagination.perPage}
              loadPage={loadPage}
              groupByYear={isGroupByYear}
            />
          </div>
        )}

        {/*
          継ぎ足しはブラウザが動くことを前提にしている。動かない環境では 1 ページ目で
          行き止まりになるため、そのときだけページ送りを出す。
        */}
        <noscript>
          <div className="mt-10 flex justify-center">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              hrefForPage={hrefForPage}
            />
          </div>
        </noscript>
      </main>
      <Footer />
    </AppLayout>
  );
}
