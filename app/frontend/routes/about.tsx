import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Route } from "./+types/about";
import type { AboutPageData } from "~/backend/handlers/profile/pages.handler";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { loadAboutPage } from "~/backend/handlers/profile/pages.handler";
import { ComingSoon } from "~/frontend/components/coming-soon/coming-soon";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { MdastRenderer } from "~/frontend/components/mdast/mdast-renderer";
import { ProfileCard } from "~/frontend/components/profile/profile-card";
import { WorkList } from "~/frontend/components/work/work-list";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext, localeRouteContext } from "~/frontend/lib/route-context";

/*
 * プロフィールと、これまでやってきたこと。
 *
 * 中身はコンテンツリポジトリの `profile.md` から来る。まだ同期されていなければ「準備中」の
 * 一文に倒れる。**404 にはしない。** ヘッダーのナビが常に指している行き先なので、
 * 初回同期の前に「そんなページは無い」と答えるのは嘘になる。
 */
export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & CopyrightData & AboutPageData> {
  const url = new URL(request.url);
  const about = await loadAboutPage(context.get(cloudflareContext).env, url.origin);

  return {
    ...about,
    locale: context.get(localeRouteContext),
    origin: url.origin,
    copyright: resolveCopyrightYears(),
  };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin, profile, jsonLd } = loaderData;
  const translations = translationsFor(locale);

  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: translations.navigation.about,
    // 自己紹介があればそれを出す。無いうちは「準備中」の一文で代える。
    description: profile === null ? translations.comingSoon.about : profile.tagline.join(" "),
    ...(jsonLd === null ? {} : { jsonLd }),
    // 中身が無いうちは検索結果に出さない。
    noindex: profile === null,
  });
};

export default function About({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { profile, mdast, linkCards, works, copyright, origin } = loaderData;

  return (
    <AppLayout>
      <Header />
      <main className="flex flex-1 flex-col">
        {/*
          「準備中」に倒れるのはプロフィールがまだ同期されていないときだけ。`mdast` の側は
          型を絞るために並べてある (ローダは片方だけ null を返さない。D1 に行があるのに
          R2 に本文が無ければ throw する)。
        */}
        {profile === null || mdast === null ? (
          <ComingSoon heading={t("navigation.about")} description={t("comingSoon.about")} />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 py-12">
            <ProfileCard profile={profile} />

            {/*
              microformats の印は付けない。ここは h-entry ではないので、`e-content` を
              置くと「何の本文か」を指さない印だけが残る。
            */}
            <MdastRenderer node={mdast} linkCards={linkCards} siteOrigin={origin} />

            {/*
              作ったもの。**自己紹介の本文より後に置く。**

              本文が「自分は何者か」で、こちらは「何を作ったか」。先に作品を並べると、
              読み手が最初に受け取るのが成果物の一覧になる。

              出すのはフロントマターの概要までで、詳しい説明は `/works/<slug>` にある。
              1 件も無ければ節ごと出さない (空の見出しは置かない)。

              **「すべて見る」は置かない。** ここに出ているのが全部なので、続きがあると
              言うことになる。行き先としての `/works` は見出し自身が持つ (ナビからも
              直接行ける)。
            */}
            {works.length > 0 && (
              <section className="flex flex-col gap-6">
                <h2 className="text-xl font-bold tracking-tight">
                  <Link to="/works" className="press-control transition-colors hover:text-primary">
                    {t("works.heading")}
                  </Link>
                </h2>
                <WorkList works={works} />
              </section>
            )}
          </div>
        )}
      </main>
      <Footer copyright={copyright} />
    </AppLayout>
  );
}
