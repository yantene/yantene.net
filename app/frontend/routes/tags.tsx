import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Route } from "./+types/tags";
import type { TagCount } from "~/backend/handlers/notes/tags.handler";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { loadTagsPage } from "~/backend/handlers/notes/tags.handler";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & { tags: readonly TagCount[] }> {
  const tags = await loadTagsPage(context.cloudflare.env);
  return {
    tags,
    locale: resolveLocale(request),
    origin: new URL(request.url).origin,
  };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const { locale, origin } = loaderData;
  return buildPageMeta({
    locale,
    origin,
    title: translationsFor(locale).tags.title,
  });
};

/*
 * 頻度を表す大小は静的なクラスの段階で持つ。inline style で連続値を渡すと
 * CSP (style-src 'self') に style 属性ごと落とされ、全部同じ大きさになる。
 * 文字列リテラルで書くことで Tailwind のスキャンにも乗る。
 */
const tagScales = [
  "text-base font-normal",
  "text-lg font-normal",
  "text-xl font-medium",
  "text-2xl font-semibold",
  "text-3xl font-semibold",
  "text-4xl font-bold",
] as const;

/** 記事数 → タグクラウドの大小クラス。 */
function scaleByCount(count: number, min: number, max: number): string {
  const ratio = max === min ? 0.5 : (count - min) / (max - min);
  const step = Math.round(ratio * (tagScales.length - 1));

  return tagScales.at(step) ?? tagScales[0];
}

export default function TagsIndex({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { tags } = loaderData;
  const counts = tags.map((tag) => tag.count);
  const min = counts.length > 0 ? Math.min(...counts) : 0;
  const max = counts.length > 0 ? Math.max(...counts) : 0;
  // クラウドらしく散らすため名前順に並べる (大小が混ざる)。サイズが頻度を担う。
  const sorted = tags.toSorted((a, b) => a.tag.localeCompare(b.tag, "ja"));

  return (
    <AppLayout>
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
        <h1 className="text-3xl font-bold">{t("tags.heading")}</h1>

        {tags.length === 0 ? (
          <p className="mt-8 text-base-content/60">{t("tags.empty")}</p>
        ) : (
          <ul className="mt-12 flex flex-wrap items-baseline justify-center gap-x-7 gap-y-5">
            {sorted.map(({ tag, count }) => (
              <li key={tag}>
                <Link
                  to={`/notes?tag=${encodeURIComponent(tag)}`}
                  className={`${scaleByCount(count, min, max)} leading-none text-primary underline-offset-4 transition-colors hover:decoration-accent hover:underline`}
                  title={t("tags.articleCount", { count })}
                >
                  {tag}
                  <sub className="ml-0.5 align-baseline text-[0.55em] font-normal text-base-content/45">
                    {count}
                  </sub>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </AppLayout>
  );
}
