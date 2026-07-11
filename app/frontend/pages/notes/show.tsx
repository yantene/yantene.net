import { Head, Link } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import type { Root as MdastRoot } from "mdast";
import type { PageProps } from "~/frontend/page-props";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { MdastRenderer } from "~/frontend/components/mdast/mdast-renderer";
import { NoteCard } from "~/frontend/components/note-card/note-card";
import {
  TableOfContents,
  type TocHeading,
} from "~/frontend/components/toc/table-of-contents";
import { AppLayout } from "~/frontend/layouts/app-layout";

interface NoteMeta {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly imageUrl: string | null;
  readonly tags: readonly string[];
  readonly publishedOn: string;
  readonly lastModifiedOn: string;
}

interface SeriesNav {
  readonly name: string;
  readonly slug: string;
  readonly total: number;
  readonly position: number;
  readonly prev: NoteMeta | null;
  readonly next: NoteMeta | null;
}

interface NoteShowProps extends PageProps {
  readonly note: NoteMeta | null;
  readonly mdast: MdastRoot | null;
  readonly related?: readonly NoteMeta[];
  readonly headings?: readonly TocHeading[];
  readonly series?: SeriesNav | null;
}

export default function NoteShow({
  note,
  mdast,
  related = [],
  headings = [],
  series = null,
}: NoteShowProps): React.JSX.Element {
  const { t } = useTranslation();

  if (note === null || mdast === null) {
    return (
      <AppLayout>
        <Head title={t("notes.notFound.title")} />
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-center">
          <h1 className="text-3xl font-bold">{t("notes.notFound.heading")}</h1>
          <p className="mt-4 text-base-content/60">
            {t("notes.notFound.description")}
          </p>
          <Link href="/notes" className="btn btn-primary mt-8">
            {t("notes.notFound.backToList")}
          </Link>
        </main>
        <Footer />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Head title={note.title}>
        <meta name="description" content={note.summary} />
      </Head>
      <Header />
      <div className="mx-auto flex w-full max-w-6xl flex-1 justify-center gap-10 px-6 py-10">
        <main className="w-full min-w-0 max-w-3xl">
          <header className="mb-8">
            <h1 className="text-4xl font-bold">{note.title}</h1>
            <time
              dateTime={note.publishedOn}
              className="mt-2 block text-sm text-base-content/60"
            >
              {note.publishedOn}
            </time>
            {note.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {note.tags.map((tg) => (
                  <Link
                    key={tg}
                    href={`/notes?tag=${encodeURIComponent(tg)}`}
                    className="badge badge-outline gap-1 hover:badge-primary"
                  >
                    {tg}
                  </Link>
                ))}
              </div>
            )}
            {note.imageUrl !== null && (
              <img
                src={note.imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="mt-6 w-full rounded-lg object-cover"
              />
            )}
          </header>
          <MdastRenderer node={mdast} />
          {series !== null && (
            <nav className="mt-12 rounded-xl border border-base-300 bg-base-200 p-5">
              <Link
                href={`/series/${series.slug}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {t("series.label")}: {series.name}
              </Link>
              <p className="mt-1 text-xs text-base-content/60">
                {t("series.position", {
                  position: series.position,
                  total: series.total,
                })}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
                {series.prev === null ? (
                  <span />
                ) : (
                  <Link
                    href={`/notes/${series.prev.slug}`}
                    className="text-sm text-base-content/80 hover:text-primary"
                  >
                    ← {series.prev.title}
                  </Link>
                )}
                {series.next !== null && (
                  <Link
                    href={`/notes/${series.next.slug}`}
                    className="text-sm text-base-content/80 hover:text-primary sm:text-right"
                  >
                    {series.next.title} →
                  </Link>
                )}
              </div>
            </nav>
          )}
          {related.length > 0 && (
            <section className="mt-16 border-t border-base-300 pt-10">
              <h2 className="mb-6 text-xl font-bold">{t("notes.related")}</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {related.map((item) => (
                  <NoteCard key={item.slug} {...item} />
                ))}
              </div>
            </section>
          )}
        </main>
        {headings.length >= 2 && (
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-24">
              <TableOfContents title={t("notes.toc")} headings={headings} />
            </div>
          </aside>
        )}
      </div>
      <Footer />
    </AppLayout>
  );
}
