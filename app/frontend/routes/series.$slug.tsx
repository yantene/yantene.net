import { useTranslation } from "react-i18next";
import { data, Link } from "react-router";
import type { Route } from "./+types/series.$slug";
import type { SeriesPageData } from "~/backend/handlers/notes/series.handler";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { loadSeriesPage } from "~/backend/handlers/notes/series.handler";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { NoteTimeline } from "~/frontend/components/note-timeline/note-timeline";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext } from "~/frontend/lib/route-context";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

export async function loader({
  request,
  params,
  context,
}: Route.LoaderArgs): Promise<
  ReturnType<typeof data<PageMetaBase & SeriesPageData>>
> {
  const url = new URL(request.url);
  const series = await loadSeriesPage(
    context.get(cloudflareContext).env,
    params.slug,
  );
  const payload = {
    ...series,
    locale: resolveLocale(request),
    origin: url.origin,
  };

  // 該当の連載が無ければ 404 ステータスで not-found 状態を描画する。
  return series.name === null ? data(payload, { status: 404 }) : data(payload);
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin, name } = loaderData;
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: name ?? translationsFor(locale).series.notFound.title,
  });
};

export default function SeriesShow({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { name, notes } = loaderData;

  if (name === null) {
    return (
      <AppLayout>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-center">
          <h1 className="text-3xl font-bold">{t("series.notFound.heading")}</h1>
          <Link to="/notes" className="btn btn-primary mt-8">
            {t("notes.notFound.backToList")}
          </Link>
        </main>
        <Footer />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <p className="text-sm font-medium text-accent-content">
          {t("series.label")}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{name}</h1>
        <p className="mt-2 text-sm text-base-content/60">
          {t("series.count", { count: notes.length })}
        </p>
        {/* 連載順に並んでいるので、年では束ねない。 */}
        <div className="mt-8">
          <NoteTimeline notes={notes} />
        </div>
      </main>
      <Footer />
    </AppLayout>
  );
}
