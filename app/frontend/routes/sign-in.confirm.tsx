import { useTranslation } from "react-i18next";
import { data } from "react-router";
import type { Route } from "./+types/sign-in.confirm";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import {
  hasPendingSignInToken,
  PRIVATE_CACHE_HEADERS,
} from "~/backend/handlers/auth/current-account";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { SignInPanel } from "~/frontend/components/sign-in/sign-in-panel";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext, localeRouteContext } from "~/frontend/lib/route-context";
import { signInConfirmPath, signInExpiredParam, signInPath } from "~/lib/constants/sign-in";

/*
 * 別の端末で踏んだ人に、押してもらう画面 (ADR 0039)。
 *
 * **会社のメールのリンク検査は `GET` しかしない。** トークンを使い切るのを押した
 * ときだけにすると、検査器はここで止まり、本人が踏む前に潰されることがなくなる。
 * 頼んだブラウザ自身から踏まれたときは受け口が近道を通すので、この画面は出ない。
 */

interface SignInConfirmData extends PageMetaBase, CopyrightData {
  /** 押してもらえる状態か。cookie にトークンが載っているかだけで決める。 */
  readonly pending: boolean;
  /** 使えないリンクだったことを伝えて戻ってきたか。 */
  readonly expired: boolean;
}

export function loader({
  request,
  context,
}: Route.LoaderArgs): ReturnType<typeof data<SignInConfirmData>> {
  const url = new URL(request.url);

  return data(
    {
      locale: context.get(localeRouteContext),
      origin: url.origin,
      copyright: resolveCopyrightYears(),
      pending: hasPendingSignInToken(context.get(cloudflareContext).env, request),
      expired: url.searchParams.has(signInExpiredParam),
    },
    // 人によって中身が変わる。経路のどこかに載ると他人に配られる。
    { headers: PRIVATE_CACHE_HEADERS },
  );
}

/**
 * 人によって中身が変わる応答を、経路のどこにも置かせない。
 *
 * **loader が `data(..., { headers })` で付けただけでは文書の応答に載らない。**
 * React Router はルートがこれを出しているときにだけ loader のヘッダーを引き継ぐ。
 * 実際に載っていないことを手元で見て気づいた。
 */
export const headers: Route.HeadersFunction = () => PRIVATE_CACHE_HEADERS;

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

export default function SignInConfirm({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { pending, expired } = loaderData;

  return (
    <AppLayout>
      <Header />
      <main className="flex flex-1 flex-col">
        {pending ? (
          <SignInPanel
            lead={t("signIn.confirm")}
            notice={expired ? t("signIn.expired") : undefined}
          >
            <form method="post" action={signInConfirmPath}>
              <button
                type="submit"
                className="press-control w-full rounded-md border border-border px-3 py-2 font-bold"
              >
                {t("signIn.confirmAction")}
              </button>
            </form>
          </SignInPanel>
        ) : (
          <SignInPanel lead={t("signIn.expired")}>
            <a
              href={signInPath}
              className="press-control rounded-md border border-border px-3 py-2 text-center font-bold"
            >
              {t("signIn.retry")}
            </a>
          </SignInPanel>
        )}
      </main>
      <Footer copyright={loaderData.copyright} />
    </AppLayout>
  );
}
