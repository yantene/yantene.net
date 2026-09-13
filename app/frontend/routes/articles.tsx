import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/articles";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { ArticlesListPageData } from "~/backend/handlers/articles/pages.handler";
import type { LoadArticlePage } from "~/frontend/components/article-timeline/infinite-article-timeline";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { loadArticlesListPage } from "~/backend/handlers/articles/pages.handler";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { InfiniteArticleTimeline } from "~/frontend/components/article-timeline/infinite-article-timeline";
import { parseArticleListPayload } from "~/frontend/components/article-timeline/article-list-payload";
import { Pagination } from "~/frontend/components/pagination/pagination";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext, localeRouteContext } from "~/frontend/lib/route-context";
import { feedIdentity } from "~/lib/feed";

const DEFAULT_PER_PAGE = 20;

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & CopyrightData & ArticlesListPageData> {
  const url = new URL(request.url);
  const data = await loadArticlesListPage(context.get(cloudflareContext).env, url);
  return {
    ...data,
    locale: context.get(localeRouteContext),
    origin: url.origin,
    copyright: resolveCopyrightYears(),
  };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin } = loaderData;
  const translations = translationsFor(locale);
  const identity = feedIdentity("articles");
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: translations.articles.title,
    description: translations.articles.lead,
    /*
     * この場所に対応するフィードを名指しする。root が出す全体のフィードを上書きするので、
     * ここを見ているリーダーには記事だけのフィードが見つかる。
     */
    feed: { path: identity.path, title: identity.title },
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
function buildHrefForPage(page: number, perPage: number, sort: SortState): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (perPage !== DEFAULT_PER_PAGE) params.set("per-page", String(perPage));
  if (sort.sortBy !== null) params.set("sort-by", sort.sortBy);
  if (sort.order !== null) params.set("order", sort.order);
  const query = params.toString();
  return query.length > 0 ? `/articles?${query}` : "/articles";
}

/**
 * 続きを取りに行く手を、いまの並び順に合わせて作る。
 *
 * 既定の取り方 (`/api/v1/articles` をそのまま叩く) では並び順が引き継がれず、一覧の
 * 2 ページ目が別の順で返る。ここで同じ条件を渡す。
 */
function buildLoadPage(sort: SortState): LoadArticlePage {
  return async (page, perPage) => {
    const params = new URLSearchParams({
      page: String(page),
      "per-page": String(perPage),
    });
    if (sort.sortBy !== null) params.set("sort-by", sort.sortBy);
    if (sort.order !== null) params.set("order", sort.order);

    const response = await fetch(`/api/v1/articles?${params.toString()}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`status ${String(response.status)}`);

    const payload = parseArticleListPayload(await response.json());
    if (payload === null) throw new Error("unexpected payload");
    return payload;
  };
}

export default function ArticlesIndex({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { articles, pagination, query, sort, copyright } = loaderData;
  const hrefForPage = (page: number): string => buildHrefForPage(page, pagination.perPage, sort);
  /*
   * 取り方は毎描画で作り直さない。
   *
   * 依存に sort をそのまま置くと、loader が返す度に別のオブジェクトになるため毎描画で
   * 作り直しになる。その度に下端の見張りが張り替えられ、観測が呼ばれる前に外れて、
   * 続きが永久に読まれない。中身のプリミティブに依存させる。
   */
  const { sortBy, order } = sort;
  const loadPage = useMemo(() => buildLoadPage({ sortBy, order }), [sortBy, order]);
  /*
   * 年で束ねられるのは公開日で並んでいるときだけ。
   *
   * 検索結果は関連度順なので公開年が前後し、束ねると同じ年が飛び飛びに現れて時間軸に
   * 見えなくなる。更新日順も同じ理由で束ねない。
   */
  const isGroupByYear = query.length === 0 && (sort.sortBy === null || sort.sortBy === "published");

  return (
    <AppLayout>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {/*
          ページの名乗り。**何の場所なのかを先に書く。**

          検索欄を主役に据えていたときは、見出しを 1rem まで落として結果のラベルとして
          扱っていた。探すのはパレット (`⌘K` / `Ctrl+K`) の仕事になったので、ここは
          「Articles とは何か」を示す場所に戻す。

          題は訳さない (場所の名前。locales.test.ts に線引きがある)。説明のほうは
          読み手に語りかける文なので訳す。
        */}
        <header className="articles-intro">
          <h1 className="articles-heading">{t("articles.heading")}</h1>
          <p className="articles-lead">{t("articles.lead")}</p>
        </header>

        {/*
          絞り込んだ結果を見ているときだけ、何で絞ったのかを出す。

          **見出しは差し替えない。** ここは検索語によらず Articles という場所で、題ごと
          入れ替えると、同じ URL がページによって別の名前を名乗ることになる。

          ここへ来る道は 2 つ — パレットの「すべての結果を見る」と、`?q=` を直接
          叩いた場合。ページ内に検索欄は無いので、絞り直すにはパレットを開き直す。
        */}
        {query.length > 0 && (
          <p className="articles-results">
            {t("search.resultsFor", { query, count: pagination.total })}
          </p>
        )}

        {articles.length === 0 ? (
          <p className="mt-8 text-base-content/60">
            {t(query.length > 0 ? "search.empty" : "articles.empty")}
          </p>
        ) : (
          <div className="mt-8">
            <InfiniteArticleTimeline
              initialArticles={articles}
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
