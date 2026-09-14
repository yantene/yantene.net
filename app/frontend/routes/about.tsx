import { useTranslation } from "react-i18next";
import type { Route } from "./+types/about";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { AboutPageData } from "~/backend/handlers/profile/about-page.handler";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { loadAboutPage } from "~/backend/handlers/profile/about-page.handler";
import { ComingSoon } from "~/frontend/components/coming-soon/coming-soon";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { MdastRenderer } from "~/frontend/components/mdast/mdast-renderer";
import { ProfileCard } from "~/frontend/components/profile/profile-card";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext, localeRouteContext } from "~/frontend/lib/route-context";

/*
 * 書き手のプロフィールと、これまでやってきたこと。
 *
 * 中身はコンテンツリポジトリの `profile.md` から来る (ADR 0041)。**まだ同期していなければ
 * 「準備中」に倒す。** 初回の refresh の前と `profile.md` を消した直後がそれに当たり、
 * ナビから来た読み手に 500 を見せないための落とし所になっている。
 */

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & CopyrightData & AboutPageData> {
  const origin = new URL(request.url).origin;

  return {
    locale: context.get(localeRouteContext),
    origin,
    copyright: resolveCopyrightYears(),
    ...(await loadAboutPage(context.get(cloudflareContext).env, origin)),
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
    /*
     * 説明は短い自己紹介をそのまま使う。行で折ってあるので 1 行に畳む
     * (OGP も検索結果も改行を出さない)。
     */
    description:
      profile === null ? translations.comingSoon.about : profile.tagline.replaceAll("\n", " "),
    jsonLd,
    // 中身が無いうちは検索結果に出さない。入れば外す (sitemap もこれと一緒に動く)。
    noindex: profile === null,
  });
};

export default function About({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { profile, mdast, origin, copyright } = loaderData;

  if (profile === null) {
    return (
      <AppLayout>
        <Header />
        <main className="flex flex-1 flex-col">
          <ComingSoon heading={t("navigation.about")} description={t("comingSoon.about")} />
        </main>
        <Footer copyright={copyright} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Header />
      {/*
        器の幅は記事本文と同じ 3xl に揃える。名乗りの下に続くのが地の文なので、
        一覧 (5xl) の幅で流すと 1 行が長くなりすぎて次の行頭を見失う。
      */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <ProfileCard profile={profile} />
        {/*
          本文は記事と同じ描画を通す。リンクカードは渡さない — プロフィールに貼るのは
          文中のリンクで、段落がリンク 1 つでできている形 (ADR 0014) にはならない。
        */}
        {mdast !== null && <MdastRenderer node={mdast} siteOrigin={origin} />}
      </main>
      <Footer copyright={copyright} />
    </AppLayout>
  );
}
