import { useTranslation } from "react-i18next";
import type { Route } from "./+types/notes";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { JsonLdData, PageMetaBase } from "~/frontend/lib/page-meta";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { ComingSoon } from "~/frontend/components/coming-soon/coming-soon";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { collectionPageJsonLd } from "~/backend/handlers/json-ld";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { localeRouteContext } from "~/frontend/lib/route-context";
import { feedIdentity } from "~/lib/feed";

/*
 * 題の無い短文の投稿。
 *
 * 中身が入るのは #412。それまでは「準備中」の一文だけを置く。
 *
 * **ヘッダーのナビにもフィードの選び場所にも並べていない。** 何を置く場所にするかが
 * まだ決まっていないため。それでもページとフィード (`/feed/notes.xml`) は実在させて
 * おく — 既に外へ出た URL なので、404 に戻すと辿ってきた人の手元で壊れて見える。
 */

export function loader({
  request,
  context,
}: Route.LoaderArgs): PageMetaBase & CopyrightData & JsonLdData {
  const origin = new URL(request.url).origin;
  return {
    locale: context.get(localeRouteContext),
    origin,
    copyright: resolveCopyrightYears(),
    jsonLd: collectionPageJsonLd(origin, "/notes"),
  };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin, jsonLd } = loaderData;
  const translations = translationsFor(locale);
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    jsonLd,
    title: translations.navigation.notes,
    description: translations.comingSoon.notes,
    /*
     * 中身はまだ無いが、フィードは実在する (entry 0 件の Atom)。ここで名指ししておくと、
     * いま購読しておいた人に、中身が入った時点で届く。
     */
    feed: { path: feedIdentity("notes").path, title: feedIdentity("notes").title },
    // 中身が無いうちは検索結果に出さない。
    noindex: true,
  });
};

export default function Notes({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Header />
      <main className="flex flex-1 flex-col">
        <ComingSoon heading={t("navigation.notes")} description={t("comingSoon.notes")} />
      </main>
      <Footer copyright={loaderData.copyright} />
    </AppLayout>
  );
}
