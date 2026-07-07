import { Head } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import type { PageProps } from "~/frontend/page-props";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { NoteCard } from "~/frontend/components/note-card/note-card";
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

interface SearchProps extends PageProps {
  readonly query: string;
  readonly notes: readonly NoteMeta[];
}

export default function Search({
  query,
  notes,
}: SearchProps): React.JSX.Element {
  const { t } = useTranslation();
  const hasQuery = query.length > 0;

  return (
    <AppLayout>
      <Head
        title={hasQuery ? `${t("search.title")}: ${query}` : t("search.title")}
      />
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold">{t("search.title")}</h1>

        {/* JS 不要で動く素の GET フォーム。SSR で結果を描画する。 */}
        <form method="get" action="/search" role="search" className="mt-6">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t("search.placeholder")}
            aria-label={t("search.title")}
            autoComplete="off"
            className="input input-bordered w-full max-w-md"
          />
        </form>

        {hasQuery && (
          <p className="mt-6 text-sm text-base-content/60">
            {t("search.resultCount", { count: notes.length })}
          </p>
        )}

        {notes.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => (
              <NoteCard key={note.slug} {...note} />
            ))}
          </div>
        ) : (
          hasQuery && (
            <p className="mt-4 text-base-content/60">{t("search.empty")}</p>
          )
        )}
      </main>
      <Footer />
    </AppLayout>
  );
}
