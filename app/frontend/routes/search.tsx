import { useTranslation } from "react-i18next";
import type { Route } from "./+types/search";
import type { SearchPageData } from "~/backend/handlers/notes/search.handler";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { loadSearchPage } from "~/backend/handlers/notes/search.handler";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { NoteTimeline } from "~/frontend/components/note-timeline/note-timeline";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext } from "~/frontend/lib/route-context";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & SearchPageData> {
  const url = new URL(request.url);
  const result = await loadSearchPage(
    context.get(cloudflareContext).env,
    url.searchParams.get("q") ?? undefined,
  );
  return { ...result, locale: resolveLocale(request), origin: url.origin };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin, query } = loaderData;
  const searchTitle = translationsFor(locale).search.title;
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: query.length > 0 ? `${searchTitle}: ${query}` : searchTitle,
  });
};

export default function Search({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { query, notes } = loaderData;
  const hasQuery = query.length > 0;

  return (
    <AppLayout>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {/*
          見出しが結果そのものを述べる。検索欄はヘッダーに常にあるので、ここでは繰り返さない。
        */}
        <h1 className="text-2xl font-bold">
          {hasQuery
            ? t("search.resultsFor", { query, count: notes.length })
            : t("search.title")}
        </h1>

        {/*
          ヘッダーの検索欄はブラウザが動かなくても素の GET フォームとして働くが、幅の狭い
          画面では畳まれている。そのときだけ、ここに同じフォームを出して行き止まりを防ぐ。
        */}
        <form
          method="get"
          action="/search"
          role="search"
          className="mt-6 sm:hidden"
        >
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t("search.placeholder")}
            aria-label={t("search.title")}
            autoComplete="off"
            className="input input-bordered w-full max-w-md"
          />
        </form>

        {notes.length > 0 ? (
          <div className="mt-8">
            <NoteTimeline notes={notes} />
          </div>
        ) : (
          hasQuery && (
            <p className="mt-4 text-base-content/60">{t("search.empty")}</p>
          )
        )}
      </main>
      <Footer />
    </AppLayout>
  );
}
