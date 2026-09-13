import { useTranslation } from "react-i18next";
import type { Route } from "./+types/about";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { ComingSoon } from "~/frontend/components/coming-soon/coming-soon";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { localeRouteContext } from "~/frontend/lib/route-context";

/*
 * プロフィールと、これまでやってきたこと。
 *
 * 中身が入るのは #413。それまでは「準備中」の一文だけを置く。ヘッダーのナビには
 * 既に並んでいるので、行き先が 404 だとサイトが壊れて見える。
 */

export function loader({ request, context }: Route.LoaderArgs): PageMetaBase & CopyrightData {
  return {
    locale: context.get(localeRouteContext),
    origin: new URL(request.url).origin,
    copyright: resolveCopyrightYears(),
  };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin } = loaderData;
  const translations = translationsFor(locale);
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: translations.navigation.about,
    description: translations.comingSoon.about,
    // 中身が無いうちは検索結果に出さない。
    noindex: true,
  });
};

export default function About({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Header />
      <main className="flex flex-1 flex-col">
        <ComingSoon heading={t("navigation.about")} description={t("comingSoon.about")} />
      </main>
      <Footer copyright={loaderData.copyright} />
    </AppLayout>
  );
}
