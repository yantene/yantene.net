import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import type { HomePageData } from "~/backend/handlers/notes/pages.handler";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { loadHomePage } from "~/backend/handlers/notes/pages.handler";
import { HeroSection } from "~/frontend/components/hero/hero-section";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { NoteTimeline } from "~/frontend/components/note-timeline/note-timeline";
import { PopularNotes } from "~/frontend/components/note-timeline/popular-notes";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext } from "~/frontend/lib/route-context";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & HomePageData> {
  const home = await loadHomePage(context.get(cloudflareContext).env);
  return {
    ...home,
    locale: resolveLocale(request),
    origin: new URL(request.url).origin,
  };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin } = loaderData;
  const home = translationsFor(locale).home;
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: home.heading,
    description: home.tagline,
  });
};

export default function Home({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { recent, popular } = loaderData;

  return (
    <AppLayout>
      {/* 透過ヘッダを Celestim ヒーローの上に重ねる。ヒーローは pt で頭を空けている。 */}
      <Header variant="transparent" />
      <HeroSection />

      {recent.length > 0 && (
        <section className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
          {/*
            主 (時間軸) と従 (よく読まれている) を並べる。記事ページの「本文 + 右の目次」と
            同じ骨格にして、サイト内で構成を揃える。狭い画面では柱が下に落ちる。
          */}
          {/* 見出しの高さは違うので、ベースラインで揃える。 */}
          <div className="flex flex-col gap-12 lg:flex-row lg:items-baseline lg:gap-16">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold">{t("home.recentNotes")}</h2>
              <div className="mt-8">
                <NoteTimeline notes={recent} groupByYear />
              </div>
              {/*
                ホームは入口なので、ここで打ち切って一覧へ送る。全件を辿る導線と
                絞り込みは /notes が持つ。線の続きに見えるよう、時間軸と同じ側に置く。
              */}
              <p className="home-view-all">
                <Link to="/notes" className="link link-primary text-sm">
                  {t("home.viewAll")}
                </Link>
              </p>
            </div>

            {popular.length > 0 && (
              <aside className="lg:w-60 lg:shrink-0">
                <h2 className="text-sm font-bold tracking-wide text-base-content/70">
                  {t("home.popularNotes")}
                </h2>
                <div className="mt-5">
                  <PopularNotes notes={popular} />
                </div>
              </aside>
            )}
          </div>
        </section>
      )}

      <Footer />
    </AppLayout>
  );
}
