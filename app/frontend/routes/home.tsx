import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import type { PublicNote } from "~/backend/handlers/note-view";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { loadRecentNotes } from "~/backend/handlers/notes/pages.handler";
import { HeroSection } from "~/frontend/components/hero/hero-section";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { NoteCard } from "~/frontend/components/note-card/note-card";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<PageMetaBase & { notes: readonly PublicNote[] }> {
  const notes = await loadRecentNotes(context.cloudflare.env);
  return {
    notes,
    locale: resolveLocale(request),
    origin: new URL(request.url).origin,
  };
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin } = loaderData;
  const home = translationsFor(locale).home;
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: home.heading,
    description: home.tagline,
  });
};

export default function Home({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { notes } = loaderData;

  return (
    <AppLayout>
      {/* 透過ヘッダを Celestim ヒーローの上に重ねる。ヒーローは pt で頭を空けている。 */}
      <Header variant="transparent" />
      <HeroSection />

      {notes.length > 0 && (
        <section className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-bold">{t("home.recentNotes")}</h2>
            <Link to="/notes" className="link link-primary text-sm">
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
