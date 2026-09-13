import { useTranslation } from "react-i18next";
import type { Route } from "./+types/works";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import type { WorksPageData } from "~/backend/handlers/works/pages.handler";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { loadWorksPage } from "~/backend/handlers/works/pages.handler";
import { ComingSoon } from "~/frontend/components/coming-soon/coming-soon";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { WorkList } from "~/frontend/components/work/work-list";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext, localeRouteContext } from "~/frontend/lib/route-context";

/*
 * 作ったもの。
 *
 * 中身はコンテンツリポジトリの `works/<slug>.md` から来る。まだ同期されていなければ
 * 「準備中」の一文に倒れる。**404 にはしない。** ヘッダーのナビが常に指している
 * 行き先なので、初回同期の前に「そんなページは無い」と答えるのは嘘になる
 * (`/about` と同じ決め)。
 *
 * **フィードは名指ししない。** 作ったものは購読するものではないので、そもそも
 * 持っていない (ADR 0042)。ここで何も書かなければ root が出す全体のフィードが残る。
 */
export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & CopyrightData & WorksPageData> {
  const url = new URL(request.url);
  const data = await loadWorksPage(context.get(cloudflareContext).env);

  return {
    ...data,
    locale: context.get(localeRouteContext),
    origin: url.origin,
    copyright: resolveCopyrightYears(),
  };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin, works } = loaderData;
  const translations = translationsFor(locale);

  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: translations.works.title,
    // 中身があればこの場所の説明を、無いうちは「準備中」の一文で代える。
    description: works.length === 0 ? translations.comingSoon.works : translations.works.lead,
    // 中身が無いうちは検索結果に出さない。
    noindex: works.length === 0,
  });
};

export default function WorksIndex({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { works, copyright } = loaderData;

  return (
    <AppLayout>
      <Header />
      <main className="flex flex-1 flex-col">
        {works.length === 0 ? (
          <ComingSoon heading={t("navigation.works")} description={t("comingSoon.works")} />
        ) : (
          <div className="mx-auto w-full max-w-3xl px-6 py-12">
            {/*
              ページの名乗り。題は訳さない (場所の名前。locales.test.ts に線引きがある)。
              説明のほうは読み手に語りかける文なので訳す。
            */}
            <header className="page-intro">
              <h1 className="page-heading">{t("works.heading")}</h1>
              <p className="page-lead">{t("works.lead")}</p>
            </header>

            <WorkList works={works} />
          </div>
        )}
      </main>
      <Footer copyright={copyright} />
    </AppLayout>
  );
}
