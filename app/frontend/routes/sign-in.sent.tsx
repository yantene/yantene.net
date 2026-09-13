import { useTranslation } from "react-i18next";
import type { Route } from "./+types/sign-in.sent";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { SignInPanel } from "~/frontend/components/sign-in/sign-in-panel";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { localeRouteContext } from "~/frontend/lib/route-context";

/*
 * リンクを送ったことを伝える画面 (ADR 0039)。
 *
 * **送れたかどうかは言わない。** 打たれたアドレスが入れるものかどうかで文言を変えると、
 * 誰がこのサイトに入れるのかを総当たりで数えられる。だからこの画面は loader で何も
 * 調べず、常に同じ字を出す。
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
    title: translations.signIn.title,
    description: translations.signIn.lead,
    noindex: true,
  });
};

export default function SignInSent({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Header />
      <main className="flex flex-1 flex-col">
        <SignInPanel lead={t("signIn.sent")}>
          <p className="text-sm text-muted-foreground">{t("signIn.sentNote")}</p>
        </SignInPanel>
      </main>
      <Footer copyright={loaderData.copyright} />
    </AppLayout>
  );
}
