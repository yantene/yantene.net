import { useTranslation } from "react-i18next";
import type { Route } from "./+types/slides";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { ComingSoon } from "~/frontend/components/coming-soon/coming-soon";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { localeRouteContext } from "~/frontend/lib/route-context";
import { feedIdentity } from "~/lib/feed";

/*
 * 発表で使ったスライドと、その置き場所。
 *
 * 中身が入るのは #415。それまでは「準備中」の一文だけを置く。ヘッダーのナビには
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
    title: translations.navigation.slides,
    description: translations.comingSoon.slides,
    /*
     * 中身はまだ無いが、フィードは実在する (entry 0 件の Atom)。ここで名指ししておくと、
     * いま購読しておいた人に、中身が入った時点で届く。
     */
    feed: { path: feedIdentity("slides").path, title: feedIdentity("slides").title },
    // 中身が無いうちは検索結果に出さない。
    noindex: true,
  });
};

export default function Slides({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Header />
      <main className="flex flex-1 flex-col">
        <ComingSoon heading={t("navigation.slides")} description={t("comingSoon.slides")} />
      </main>
      <Footer copyright={loaderData.copyright} />
    </AppLayout>
  );
}
