import { Head, Link } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import type { PageProps } from "~/frontend/page-props";
import { HeroSection } from "~/frontend/components/hero/hero-section";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import {
  NoteCard,
  type NoteCardProps,
} from "~/frontend/components/note-card/note-card";
import { AppLayout } from "~/frontend/layouts/app-layout";

interface HomeProps extends PageProps {
  /** 新着ノート (公開日降順・最大 6 件)。 */
  readonly notes: readonly NoteCardProps[];
}

export default function Home({ notes }: HomeProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Head title={t("home.heading")}>
        <meta name="description" content={t("home.tagline")} />
      </Head>
      {/* 透過ヘッダを Celestim ヒーローの上に重ねる。ヒーローは pt で頭を空けている。 */}
      <Header variant="transparent" />
      <HeroSection />

      {notes.length > 0 && (
        <section className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-bold">{t("home.recentNotes")}</h2>
            <Link href="/notes" className="link link-primary text-sm">
              {t("home.viewAll")}
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => (
              <NoteCard key={note.slug} {...note} />
            ))}
          </div>
        </section>
      )}

      <Footer />
    </AppLayout>
  );
}
