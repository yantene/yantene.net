import { useTranslation } from "react-i18next";
import { SiMarkdown } from "react-icons/si";
import { data, Link } from "react-router";
import type { Route } from "./+types/notes.$slug";
import type { NoteDetailPageData } from "~/backend/handlers/notes/detail.handler";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { loadNoteDetailPage } from "~/backend/handlers/notes/detail.handler";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { MdastRenderer } from "~/frontend/components/mdast/mdast-renderer";
import { NoteBranches } from "~/frontend/components/note-branches/note-branches";
import { TableOfContents } from "~/frontend/components/toc/table-of-contents";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext } from "~/frontend/lib/route-context";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

export async function loader({
  request,
  params,
  context,
}: Route.LoaderArgs): Promise<
  ReturnType<typeof data<PageMetaBase & NoteDetailPageData>>
> {
  const url = new URL(request.url);
  const cloudflare = context.get(cloudflareContext);
  // 読み手のセッション識別子を預け直す cookie を応答に載せる (ADR 0011)。
  // React Router は loader が付けた Set-Cookie を、文書・データどちらの応答にも運ぶ。
  const headers = new Headers();
  const detail = await loadNoteDetailPage(
    cloudflare.env,
    params.slug,
    url.origin,
    {
      userAgent: request.headers.get("user-agent"),
      cookie: request.headers.get("cookie"),
      waitUntil: (promise) => {
        cloudflare.ctx.waitUntil(promise);
      },
      setCookie: (value) => {
        headers.append("set-cookie", value);
      },
    },
  );
  const base = { locale: resolveLocale(request), origin: url.origin };

  // 存在しない slug は 404 ステータスで not-found 状態のページを描画する。
  if (!detail.found) {
    return data({ ...base, ...detail }, { status: 404, headers });
  }
  return data({ ...base, ...detail }, { headers });
}

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin } = loaderData;

  if (!loaderData.found) {
    return buildPageMeta({
      locale,
      origin,
      pathname: location.pathname,
      title: translationsFor(locale).notes.notFound.title,
    });
  }

  const { note, jsonLd } = loaderData;
  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: note.title,
    description: note.summary,
    imagePath: `/og/notes/${note.slug}`,
    type: "article",
    jsonLd,
  });
};

export default function NoteShow({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();

  if (!loaderData.found) {
    return (
      <AppLayout>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-center">
          <h1 className="text-3xl font-bold">{t("notes.notFound.heading")}</h1>
          <p className="mt-4 text-base-content/60">
            {t("notes.notFound.description")}
          </p>
          <Link to="/notes" className="btn btn-primary press-control mt-8">
            {t("notes.notFound.backToList")}
          </Link>
        </main>
        <Footer />
      </AppLayout>
    );
  }

  const { note, mdast, related, headings } = loaderData;

  return (
    <AppLayout>
      <Header />
      <div className="mx-auto flex w-full max-w-6xl flex-1 justify-center gap-10 px-6 py-10">
        <main className="w-full min-w-0 max-w-3xl">
          <header className="note-header mb-8">
            {/*
              読み始める前に「いつの、何を読むのか」が分かるようにする。日付と種別を
              表題の上に置き、細い線で本文と隔てる。
            */}
            <p className="note-header-eyebrow">
              <time dateTime={note.publishedOn}>
                {note.publishedOn.replaceAll("-", ".")}
              </time>
              <span className="note-header-kind">NOTE</span>
            </p>
            <h1 className="note-header-title">{note.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-base-content/60">
              {/*
                原文 Markdown は React Router のルートではなく Hono が返すので、
                Link ではなく素の <a> にする (クライアント遷移させない)。
              */}
              <a
                href={`/notes/${note.slug}.md`}
                className="press-control inline-flex items-center gap-1 hover:text-primary hover:underline"
              >
                <SiMarkdown aria-hidden="true" />
                {t("notes.viewMarkdown")}
              </a>
            </div>
            {note.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {note.tags.map((tg) => (
                  <Link
                    key={tg}
                    to={`/notes?tag=${encodeURIComponent(tg)}`}
                    className="badge badge-outline press-control gap-1 hover:badge-primary"
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
          {related.length > 0 && (
            <section className="note-related">
              <h2 className="note-related-heading">{t("notes.related")}</h2>
              <NoteBranches notes={related} />
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
