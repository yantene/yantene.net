import { Head, Link } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import type { PageProps } from "~/frontend/page-props";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { AppLayout } from "~/frontend/layouts/app-layout";

interface TagCount {
  readonly tag: string;
  readonly count: number;
}

interface TagsIndexProps extends PageProps {
  readonly tags: readonly TagCount[];
}

/** 記事数 → フォントサイズ(rem)・太さ。頻度をサイズで表すタグクラウド用。 */
function scaleByCount(
  count: number,
  min: number,
  max: number,
): { fontSize: string; fontWeight: number } {
  const ratio = max === min ? 0.5 : (count - min) / (max - min);
  return {
    fontSize: `${(1 + ratio * 1.7).toFixed(3)}rem`,
    fontWeight: 400 + Math.round(ratio * 3) * 100,
  };
}

export default function TagsIndex({ tags }: TagsIndexProps): React.JSX.Element {
  const { t } = useTranslation();
  const counts = tags.map((tag) => tag.count);
  const min = counts.length > 0 ? Math.min(...counts) : 0;
  const max = counts.length > 0 ? Math.max(...counts) : 0;
  // クラウドらしく散らすため名前順に並べる (大小が混ざる)。サイズが頻度を担う。
  const sorted = tags.toSorted((a, b) => a.tag.localeCompare(b.tag, "ja"));

  return (
    <AppLayout>
      <Head title={t("tags.title")} />
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
                  href={`/notes?tag=${encodeURIComponent(tag)}`}
                  style={scaleByCount(count, min, max)}
                  className="leading-none text-primary underline-offset-4 transition-colors hover:decoration-accent hover:underline"
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
