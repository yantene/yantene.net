import { useTranslation } from "react-i18next";
import { SiGithub } from "react-icons/si";
import type { Route } from "./+types/licenses";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { loadCopyrightYears } from "~/backend/handlers/copyright";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import {
  cloudflareContext,
  localeRouteContext,
} from "~/frontend/lib/route-context";

/** package.json の在り処。ここに挙げていない依存はリポジトリを見てもらう。 */
const REPOSITORY_URL = "https://github.com/yantene/yantene.net";

const OPEN_FONT_LICENSE_URL = "https://openfontlicense.org/";

/**
 * 表示することが使用の条件になっている成果物。
 *
 * MIT や BSD の依存は含めない。載せ始めると package.json の写しになり、手で写す以上
 * 必ず本体と食い違う。食い違った一覧は「全部載っている」という顔をするぶん、
 * 何も載せないより悪い。全体はリポジトリの package.json を正とする。
 *
 * ここに足すのは、ライセンスが帰属の表示そのものを条件にしているものだけ。
 */
export const ATTRIBUTIONS = [
  {
    name: "Twemoji",
    href: "https://github.com/jdecked/twemoji",
    license: "CC BY 4.0",
    licenseHref: "https://creativecommons.org/licenses/by/4.0/",
    usageKey: "licenses.usage.twemoji",
  },
  {
    name: "Noto Sans JP",
    href: "https://fonts.google.com/noto/specimen/Noto+Sans+JP",
    license: "SIL Open Font License 1.1",
    licenseHref: OPEN_FONT_LICENSE_URL,
    usageKey: "licenses.usage.notoSansJp",
  },
  {
    name: "STIX Two Math",
    href: "https://github.com/stipub/stixfonts",
    license: "SIL Open Font License 1.1",
    licenseHref: OPEN_FONT_LICENSE_URL,
    usageKey: "licenses.usage.stixTwoMath",
  },
] as const satisfies readonly {
  name: string;
  href: string;
  license: string;
  licenseHref: string;
  usageKey: string;
}[];

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & CopyrightData> {
  return {
    locale: context.get(localeRouteContext),
    origin: new URL(request.url).origin,
    copyright: await loadCopyrightYears(context.get(cloudflareContext).env),
  };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin } = loaderData;
  const licenses = translationsFor(locale).licenses;
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: licenses.title,
    description: licenses.description,
  });
};

const linkClassName =
  "press-control underline underline-offset-4 transition-colors hover:text-primary";

export default function Licenses({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { copyright } = loaderData;

  return (
    <AppLayout>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("licenses.title")}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t("licenses.lead")}
        </p>

        {/*
          1 件ずつが「何に使っていて、誰の成果で、どのライセンスか」の 3 つを持つ。
          表にしないのは、狭い画面で横に溢れるのと、件数が少ないうちは箇条書きのほうが
          読めるため。
        */}
        <ul className="mt-8 flex flex-col gap-6">
          {ATTRIBUTIONS.map((attribution) => (
            <li
              key={attribution.name}
              className="border-l-2 border-border pl-4"
            >
              <p className="text-base font-semibold text-foreground">
                <a
                  href={attribution.href}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClassName}
                >
                  {attribution.name}
                </a>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(attribution.usageKey)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("licenses.licenseLabel")}:{" "}
                <a
                  href={attribution.licenseHref}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClassName}
                >
                  {attribution.license}
                </a>
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm leading-relaxed text-muted-foreground">
          {t("licenses.rest.lead")}{" "}
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            className={`${linkClassName} inline-flex items-center gap-1.5`}
          >
            <SiGithub aria-hidden="true" />
            {t("licenses.rest.linkLabel")}
          </a>
        </p>
      </main>
      <Footer copyright={copyright} />
    </AppLayout>
  );
}
