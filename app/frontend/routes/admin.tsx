import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { data, useRevalidator } from "react-router";
import type { Route } from "./+types/admin";
import type { AdminCredentialView, AdminPageData } from "~/backend/handlers/admin/pages.handler";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { ADMIN_CACHE_HEADERS, loadAdminPage } from "~/backend/handlers/admin/pages.handler";
import { AdminSignIn } from "~/frontend/components/admin/admin-sign-in";
import { CredentialList } from "~/frontend/components/admin/credential-list";
import { RegisterPasskey } from "~/frontend/components/admin/register-passkey";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext, localeRouteContext } from "~/frontend/lib/route-context";
import type { CopyrightData } from "~/backend/handlers/copyright-years";

/**
 * 管理画面 (ADR 0036)。
 *
 * サインインしていなければ passkey で入る画面を、していれば登録した鍵の一覧を出す。
 * **この 1 ページで両方を受け持つ**のは、入口を分けると「サインイン済みなのに
 * ログイン画面に居る」状態を作るため。
 */
export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<
  ReturnType<typeof data<PageMetaBase & CopyrightData & AdminPageData>>
> {
  const env = context.get(cloudflareContext).env;
  const page = await loadAdminPage(env, request);

  return data(
    {
      locale: context.get(localeRouteContext),
      origin: new URL(request.url).origin,
      copyright: resolveCopyrightYears(),
      ...page,
    },
    {
      // 管理者が見ている応答は経路に載せない (ADR 0036)。サインインしていなくても
      // 同じ扱いにして、載る・載らないがセッションの有無で揺れないようにする。
      headers: { ...ADMIN_CACHE_HEADERS, "X-Robots-Tag": "noindex, nofollow" },
    },
  );
}

/** loader が付けたヘッダーを document の応答にも通す。 */
export function headers({ loaderHeaders }: Route.HeadersArgs): Headers {
  return loaderHeaders;
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin } = loaderData;
  const admin = translationsFor(locale).admin;
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: admin.title,
    description: admin.description,
    // 検索結果に出す意味が無い。robots.txt の Disallow と対で置く。
    robots: "noindex",
  });
};

export default function Admin({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { copyright, signedIn, credentials } = loaderData;
  const revalidator = useRevalidator();

  // サインイン・登録・取り消しはすべて loader のデータを古くする。
  // 画面を組み直すのに revalidate 1 本で足りる。
  const refresh = useCallback(() => {
    void revalidator.revalidate();
  }, [revalidator]);

  return (
    <AppLayout>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("admin.title")}</h1>

        {signedIn ? (
          <SignedIn credentials={credentials} onChange={refresh} />
        ) : (
          <AdminSignIn onSignedIn={refresh} />
        )}
      </main>
      <Footer copyright={copyright} />
    </AppLayout>
  );
}

function SignedIn({
  credentials,
  onChange,
}: {
  readonly credentials: readonly AdminCredentialView[];
  readonly onChange: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(() => {
    setSigningOut(true);
    void (async () => {
      await fetch("/api/v1/admin/session", { method: "DELETE" });
      setSigningOut(false);
      onChange();
    })();
  }, [onChange]);

  return (
    <div className="mt-8 flex flex-col gap-10">
      <CredentialList credentials={credentials} onChange={onChange} />
      <RegisterPasskey signedIn onRegistered={onChange} />
      <div>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="press-control rounded border border-border px-4 py-2 text-sm transition-colors hover:text-primary disabled:opacity-50"
        >
          {t("admin.signOut.action")}
        </button>
      </div>
    </div>
  );
}
