import { useTranslation } from "react-i18next";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import { data, Link } from "react-router";
import type { Route } from "./+types/works.$slug";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import type { WorkDetailPageData } from "~/backend/handlers/works/pages.handler";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { loadWorkDetailPage } from "~/backend/handlers/works/pages.handler";
import { ArticleTimeline } from "~/frontend/components/article-timeline/article-timeline";
import { displayUrl } from "~/frontend/components/work/display-url";
import { WorkFacts } from "~/frontend/components/work/work-facts";
import { WorkGallery } from "~/frontend/components/work/work-gallery";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { MdastRenderer } from "~/frontend/components/mdast/mdast-renderer";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { MainContent } from "~/frontend/components/layout/main-content";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext, localeRouteContext } from "~/frontend/lib/route-context";

/*
 * 作ったもの 1 件。
 *
 * 一覧 (`/works` と `/about`) が出すのはフロントマターの概要までで、詳しい説明を
 * 読むのはここだけ。見つからないときは 404 のステータスで「無い」ことを描く
 * (throw して ErrorBoundary に落とさない。記事詳細と同じ決め)。
 */
export async function loader({
  request,
  params,
  context,
}: Route.LoaderArgs): Promise<
  ReturnType<typeof data<PageMetaBase & CopyrightData & WorkDetailPageData>>
> {
  const url = new URL(request.url);
  const detail = await loadWorkDetailPage(
    context.get(cloudflareContext).env,
    params.slug,
    url.origin,
  );
  const base = {
    locale: context.get(localeRouteContext),
    origin: url.origin,
    copyright: resolveCopyrightYears(),
  };

  if (detail.work === null) {
    return data({ ...base, ...detail }, { status: 404 });
  }
  return data({ ...base, ...detail });
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin, work, jsonLd } = loaderData;
  const translations = translationsFor(locale);

  if (work === null) {
    return buildPageMeta({
      locale,
      origin,
      pathname: location.pathname,
      title: translations.works.notFound.title,
      description: translations.works.notFound.description,
      noindex: true,
    });
  }

  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: work.name,
    description: work.summary,
    ...(jsonLd === null ? {} : { jsonLd }),
  });
};

export default function WorkShow({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { work, mdast, linkCards, articles, origin, copyright } = loaderData;

  if (work === null || mdast === null) {
    return (
      <AppLayout>
        <Header />
        <MainContent className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 text-center">
          <h1 className="text-3xl font-bold">{t("works.notFound.heading")}</h1>
          <p className="mt-4 text-base-content/60">{t("works.notFound.description")}</p>
          <Link to="/works" className="btn btn-primary press-control mt-8">
            {t("works.notFound.backToList")}
          </Link>
        </MainContent>
        <Footer copyright={copyright} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Header />
      <MainContent className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
        {/*
          頭に画面を置く。**どんなものかは、名前より先に見て分かるほうが早い。**
          1 枚も無い作品では何も出ず、名前から始まる。
        */}
        <WorkGallery screenshots={work.screenshots} label={t("works.screenshotsLabel")} />

        {/*
          一覧の名乗り (page-intro) は使わない。あちらは「ここは何の場所か」を出す器で、
          ここに出るのは作品そのものの名前。下に本文が続くぶん、間の空きも違う。
        */}
        <header className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {work.name}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-base-content/70">{work.summary}</p>
          </div>

          {/*
            諸元。どの欄も書いていなければ何も出ない (空きも残さない。間の空きは親の gap が
            持つので、描かれなかった子のぶんは詰まる)。
          */}
          <WorkFacts work={work} />

          {/* 在り処は最後。名前 → 概要 → 諸元と読んだあとの「では見に行く」の出口になる。 */}
          {work.url !== null && (
            <a
              href={work.url}
              className="work-list-url press-control inline-flex items-center gap-1.5 transition-colors hover:text-primary"
            >
              {/*
                絵は行き先が外であることの印で、名前は隣の字が持っている。読み上げから
                外さないと、リンクの名前が絵の分だけ重なる。
              */}
              <span aria-hidden="true">
                <HiArrowTopRightOnSquare />
              </span>
              {displayUrl(work.url)}
            </a>
          )}
        </header>

        {/*
          microformats の印は付けない。ここは h-entry ではないので、`e-content` を
          置くと「何の本文か」を指さない印だけが残る (`/about` と同じ扱い)。
        */}
        <MdastRenderer node={mdast} linkCards={linkCards} siteOrigin={origin} />

        {/*
          この作品について書いた記事。**記事の一覧と同じ器で出す** (同じ「記事 1 本」が
          場所によって違う作りで出ると、情報の在り処が食い違う)。

          並びは書き手が決めた順なので、年では束ねない。読み手に見えない記事は loader が
          外してあり、1 本も残らなければ節ごと出さない。
        */}
        {articles.length > 0 && (
          <section>
            <h2 className="article-related-heading">{t("works.relatedArticles")}</h2>
            <ArticleTimeline articles={articles} />
          </section>
        )}
      </MainContent>
      <Footer copyright={copyright} />
    </AppLayout>
  );
}
