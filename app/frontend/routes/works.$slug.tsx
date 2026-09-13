import { useTranslation } from "react-i18next";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import { data, Link } from "react-router";
import type { Route } from "./+types/works.$slug";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import type { WorkDetailPageData } from "~/backend/handlers/works/pages.handler";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { loadWorkDetailPage } from "~/backend/handlers/works/pages.handler";
import { displayUrl } from "~/frontend/components/work/display-url";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { MdastRenderer } from "~/frontend/components/mdast/mdast-renderer";
import { AppLayout } from "~/frontend/layouts/app-layout";
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
  const { work, mdast, linkCards, origin, copyright } = loaderData;

  if (work === null || mdast === null) {
    return (
      <AppLayout>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 text-center">
          <h1 className="text-3xl font-bold">{t("works.notFound.heading")}</h1>
          <p className="mt-4 text-base-content/60">{t("works.notFound.description")}</p>
          <Link to="/works" className="btn btn-primary press-control mt-8">
            {t("works.notFound.backToList")}
          </Link>
        </main>
        <Footer copyright={copyright} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
        {/*
          一覧の名乗り (page-intro) は使わない。あちらは「ここは何の場所か」を出す器で、
          ここに出るのは作品そのものの名前。下に本文が続くぶん、間の空きも違う。
        */}
        <header>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {work.name}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-base-content/70">{work.summary}</p>

          {work.url !== null && (
            <a
              href={work.url}
              className="work-list-url press-control mt-4 inline-flex items-center gap-1.5 transition-colors hover:text-primary"
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
      </main>
      <Footer copyright={copyright} />
    </AppLayout>
  );
}
