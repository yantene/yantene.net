import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Route } from "./+types/slides";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { SlidesPageData } from "~/backend/handlers/slides/pages.handler";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { loadSlidesPage } from "~/backend/handlers/slides/pages.handler";
import { ComingSoon } from "~/frontend/components/coming-soon/coming-soon";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext, localeRouteContext } from "~/frontend/lib/route-context";
import { feedIdentity } from "~/lib/feed";

/*
 * 発表で使ったスライドの一覧 (ADR 0052)。
 *
 * 中身はコンテンツリポジトリの `slides/<slug>.md` から来る。1 本も無いうちは「準備中」の
 * 一文だけを置く (ヘッダーのナビには既に並んでいるので、行き先が 404 だとサイトが
 * 壊れて見える)。
 */
export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & CopyrightData & SlidesPageData> {
  const origin = new URL(request.url).origin;
  return {
    locale: context.get(localeRouteContext),
    origin,
    copyright: resolveCopyrightYears(),
    ...(await loadSlidesPage(context.get(cloudflareContext).env, origin)),
  };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin, slides, jsonLd } = loaderData;
  const translations = translationsFor(locale);
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    jsonLd,
    title: translations.slides.title,
    description: slides.length === 0 ? translations.comingSoon.slides : translations.slides.lead,
    // フィードは中身が無いうちから実在する。いま購読しておけば、入った時点で届く。
    feed: { path: feedIdentity("slides").path, title: feedIdentity("slides").title },
    // 中身が無いうちは検索結果に出さない。
    noindex: slides.length === 0,
  });
};

export default function SlidesIndex({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { slides, copyright } = loaderData;

  return (
    <AppLayout>
      <Header />
      <main className="flex flex-1 flex-col">
        {slides.length === 0 ? (
          <ComingSoon heading={t("navigation.slides")} description={t("comingSoon.slides")} />
        ) : (
          <div className="mx-auto w-full max-w-3xl px-6 py-12">
            <header className="page-intro">
              <h1 className="page-heading">{t("slides.heading")}</h1>
              <p className="page-lead">{t("slides.lead")}</p>
            </header>

            {/*
              新しい順。行き先は題だけが持つ (行全体を押し場所にしない。発表の場の
              リンクが中に入るので、入れ子の押し場所になる)。
            */}
            <ul className="slide-list h-feed">
              {slides.map((slide) => (
                <li key={slide.slug} className="slide-list-item h-entry">
                  <time className="slide-list-date dt-published" dateTime={slide.publishedOn}>
                    {slide.publishedOn}
                  </time>
                  <div className="slide-list-body">
                    <Link
                      to={`/slides/${slide.slug}`}
                      className="slide-list-title p-name u-url press-control"
                    >
                      {slide.title}
                    </Link>
                    {slide.event !== null && <p className="slide-list-event">{slide.event.name}</p>}
                    {slide.summary !== "" && (
                      <p className="slide-list-summary p-summary">{slide.summary}</p>
                    )}
                  </div>
                  <p className="slide-list-pages">
                    {t("slides.pages", { count: slide.pageCount })}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
      <Footer copyright={copyright} />
    </AppLayout>
  );
}
