import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { HomePageData } from "~/backend/handlers/notes/pages.handler";
import type { ClockOriginData } from "~/frontend/components/hero/clock-origin";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { loadCopyrightYears } from "~/backend/handlers/copyright";
import { loadHomePage } from "~/backend/handlers/notes/pages.handler";
import { resolveClockOrigin } from "~/frontend/components/hero/clock-origin";
import { HeroSection } from "~/frontend/components/hero/hero-section";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { NoteTimeline } from "~/frontend/components/note-timeline/note-timeline";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext, localeRouteContext } from "~/frontend/lib/route-context";

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & CopyrightData & ClockOriginData & HomePageData> {
  const env = context.get(cloudflareContext).env;
  // 互いに独立した読み出しなので、往復を直列に積まない。
  const [home, copyright] = await Promise.all([loadHomePage(env), loadCopyrightYears(env)]);
  return {
    ...home,
    locale: context.get(localeRouteContext),
    origin: new URL(request.url).origin,
    copyright,
    /*
     * ヒーローの空をどの時刻から始めるか。ここで時計を読むのは、Workers が I/O の外の
     * 時刻を Unix epoch 0 に固定するため (backend/handlers/copyright.ts に同じ注意がある)。
     */
    clockOrigin: resolveClockOrigin(new Date()),
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

export default function Home({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { recent, popular, copyright, clockOrigin } = loaderData;

  return (
    <AppLayout>
      {/*
        透過ヘッダを Celestim ヒーローの上に重ねる。ヒーローは pt で頭を空けている。
        ロゴは伏せる。すぐ下のヒーローが同じ「やんてね」を出すので、二つ並ぶと煩わしい。
      */}
      <Header variant="transparent" showLogo={false} />
      <HeroSection clockOrigin={clockOrigin} />

      {recent.length > 0 && (
        <section className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
          {/*
            主 (時間軸) と従 (よく読まれている) を並べる。記事ページの「本文 + 右の目次」と
            同じ骨格にして、サイト内で構成を揃える。狭い画面では柱が下に落ちる。
          */}
          {/*
            よく読まれている記事を先に置く。初めて来た人が知りたいのは「何が面白いか」で、
            時系列の羅列ではないため。最近の記事はその後ろで、一覧へ送り出す。
          */}
          {popular.length > 0 && (
            <div className="mb-16">
              <h2 className="text-2xl font-bold">{t("home.popularNotes")}</h2>
              <div className="mt-8">
                <NoteTimeline notes={popular} ranked />
              </div>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold">{t("home.recentNotes")}</h2>
            <div className="mt-8">
              <NoteTimeline notes={recent} groupByYear />
            </div>
            {/*
              ホームは入口なので、ここで打ち切って一覧へ送る。全件を辿る導線と
              絞り込みは /notes が持つ。線の続きに見えるよう、時間軸と同じ側に置く。
            */}
            <p className="home-view-all">
              <Link to="/notes" className="link link-primary press-control text-sm">
                {t("home.viewAll")}
              </Link>
            </p>
          </div>
        </section>
      )}

      <Footer copyright={copyright} />
    </AppLayout>
  );
}
