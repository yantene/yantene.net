import type { Route } from "./+types/sign-in";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { SignInForm } from "~/frontend/components/sign-in/sign-in-form";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { localeRouteContext } from "~/frontend/lib/route-context";
import { signInInvalidParam } from "~/lib/constants/sign-in";

/*
 * ログインの入口 (ADR 0039)。
 *
 * **ナビには出さない。** 読み手の大半には一生関係が無い。ここへの導線はロゴの連打
 * (#474) か、渡されたリンクから直接。
 */

interface SignInData extends PageMetaBase, CopyrightData {
  /** 打ち間違いを弾いて戻ってきたか。 */
  readonly invalid: boolean;
}

export function loader({ request, context }: Route.LoaderArgs): SignInData {
  const url = new URL(request.url);

  return {
    locale: context.get(localeRouteContext),
    origin: url.origin,
    copyright: resolveCopyrightYears(),
    invalid: url.searchParams.has(signInInvalidParam),
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
    /*
     * 中身ではないので検索結果に出す理由が無い。**`nofollow` は立てない** —
     * ここから先 (ヘッダーのナビ) は辿ってもらってよい。
     */
    noindex: true,
  });
};

export default function SignIn({ loaderData }: Route.ComponentProps): React.JSX.Element {
  return (
    <AppLayout>
      <Header />
      <main className="flex flex-1 flex-col">
        <SignInForm invalid={loaderData.invalid} />
      </main>
      <Footer copyright={loaderData.copyright} />
    </AppLayout>
  );
}
