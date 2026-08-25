import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HiMagnifyingGlass } from "react-icons/hi2";
import type { Route } from "./+types/notes";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { NotesListPageData } from "~/backend/handlers/notes/pages.handler";
import type { LoadNotePage } from "~/frontend/components/note-timeline/infinite-note-timeline";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { loadCopyrightYears } from "~/backend/handlers/copyright";
import { loadNotesListPage } from "~/backend/handlers/notes/pages.handler";
import { FeedLink } from "~/frontend/components/feed/feed-link";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { InfiniteNoteTimeline } from "~/frontend/components/note-timeline/infinite-note-timeline";
import { parseNoteListPayload } from "~/frontend/components/note-timeline/note-list-payload";
import { Pagination } from "~/frontend/components/pagination/pagination";
import { TagIndex } from "~/frontend/components/tag-index/tag-index";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import {
  cloudflareContext,
  localeRouteContext,
} from "~/frontend/lib/route-context";
import { feedIdentity } from "~/lib/feed";

const DEFAULT_PER_PAGE = 20;

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<
  PageMetaBase & CopyrightData & NotesListPageData
> {
  const url = new URL(request.url);
  const env = context.get(cloudflareContext).env;
  // 互いに独立した読み出しなので、往復を直列に積まない。
  const [data, copyright] = await Promise.all([
    loadNotesListPage(env, url),
    loadCopyrightYears(env),
  ]);
  return {
    ...data,
    locale: context.get(localeRouteContext),
    origin: url.origin,
    copyright,
  };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin, tag } = loaderData;
  const { title, path } = feedIdentity(tag);
  const notes = translationsFor(locale).notes;
  /*
   * 絞り込んでいるときは、どのタグの一覧かを title に出す。検索結果や共有先では
   * title しか見えないため、絞り込みなしと同じ名前だと区別が付かない。
   * 画面の見出しと同じ表現 (filteredByTag) を使って言い回しを揃える。
   * 置換先は関数で渡す ($& などの特殊な並びをタグ名がそのまま含み得るため)。
   */
  const pageTitle =
    tag === null
      ? notes.title
      : notes.filteredByTag.replace("{{tag}}", () => tag);
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: pageTitle,
    /*
     * 絞り込んでいないときは何も足さない。root が出すサイト全体のフィードと
     * 同じものになり、リーダーに同じ購読先を二重に見せてしまう。
     */
    feed: tag === null ? undefined : { path, title },
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

/**
 * 結果の見出しを組み立てる。
 *
 * 何で絞った結果を見ているのかが一目で分かるようにする。検索語もタグも無いときは
 * ページの名前をそのまま出す。
 */
function resultHeading(
  t: (key: string, options?: Record<string, unknown>) => string,
  { query, tag, total }: { query: string; tag: string | null; total: number },
): string {
  if (query.length > 0 && tag !== null) {
    return t("notes.resultsForQueryAndTag", { query, tag, count: total });
  }
  if (query.length > 0) return t("search.resultsFor", { query, count: total });
  if (tag !== null) return t("notes.resultsForTag", { tag, count: total });
  return t("notes.heading");
}

export default function NotesIndex({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { notes, pagination, query, tag, tags, sort, copyright } = loaderData;
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
  /*
   * 年で束ねられるのは公開日で並んでいるときだけ。
   *
   * 検索結果は関連度順なので公開年が前後し、束ねると同じ年が飛び飛びに現れて時間軸に
   * 見えなくなる。更新日順も同じ理由で束ねない。
   */
  const isGroupByYear =
    query.length === 0 && (sort.sortBy === null || sort.sortBy === "published");

  return (
    <AppLayout>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {/*
          このページが検索の入口と結果を兼ねる。探す前と後で別のページへ飛ばさず、
          フォームは常に同じ場所に置いたままにする。
        */}
        <search className="notes-search">
          <form method="get" action="/notes" role="search">
            {/* 絞り込みを保ったまま探せるよう、いま効いているタグを持ち回す。 */}
            {tag !== null && <input type="hidden" name="tag" value={tag} />}
            <label className="notes-search-field">
              <HiMagnifyingGlass className="notes-search-icon" aria-hidden />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder={t("search.placeholder")}
                aria-label={t("search.title")}
                autoComplete="off"
              />
            </label>
          </form>

          {tags.length > 0 && (
            <TagIndex tags={tags} selected={tag} query={query} />
          )}
        </search>

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className="notes-heading">
            {resultHeading(t, { query, tag, total: pagination.total })}
          </h1>
          {/*
            一覧の入口に置く購読導線。ここは「全件を辿る」ページなので、辿らずに
            受け取り続ける手を同じ高さに並べる。絞り込み中はそのタグのフィードを指す
            (見えている一覧と受け取るものを一致させる)。そのときはフッターの全体
            フィードと行き先が分かれるので、文言も分ける。
          */}
          <FeedLink
            href={feedIdentity(tag).path}
            label={tag === null ? undefined : t("feed.tagLabel", { tag })}
          />
        </div>

        {notes.length === 0 ? (
          <p className="mt-8 text-base-content/60">
            {t(query.length > 0 ? "search.empty" : "notes.empty")}
          </p>
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
      <Footer copyright={copyright} />
    </AppLayout>
  );
}
