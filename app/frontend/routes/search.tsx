import { useTranslation } from "react-i18next";
import type { Route } from "./+types/search";
import type { SearchPageData } from "~/backend/handlers/notes/search.handler";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { loadSearchPage } from "~/backend/handlers/notes/search.handler";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { NoteCard } from "~/frontend/components/note-card/note-card";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & SearchPageData> {
  const url = new URL(request.url);
  const result = await loadSearchPage(
    context.cloudflare.env,
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
        <h1 className="text-2xl font-bold">{t("search.title")}</h1>

        {/* JS 不要で動く素の GET フォーム。SSR で結果を描画する。 */}
        <form method="get" action="/search" role="search" className="mt-6">
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

        {hasQuery && (
          <p className="mt-6 text-sm text-base-content/60">
            {t("search.resultCount", { count: notes.length })}
          </p>
        )}

        {notes.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => (
              <NoteCard key={note.slug} {...note} />
            ))}
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
