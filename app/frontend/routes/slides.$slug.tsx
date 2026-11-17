import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { data, Link } from "react-router";
import type { Route } from "./+types/slides.$slug";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { SlideDetailPageData } from "~/backend/handlers/slides/pages.handler";
import type { SlideContext } from "~/frontend/components/slide/slide-page";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { PRIVATE_CACHE_HEADERS } from "~/backend/handlers/auth/current-account";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { loadSlideDetailPage } from "~/backend/handlers/slides/pages.handler";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { MdastRenderer } from "~/frontend/components/mdast/mdast-renderer";
import { SlideDeck } from "~/frontend/components/slide/slide-deck";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext, localeRouteContext } from "~/frontend/lib/route-context";
import { paginate, withoutPauses } from "~/lib/slides/deck";

/*
 * スライド 1 本 (ADR 0052)。
 *
 * 上にスライド、下に同じ原文を読み物として置く。**原文は 1 つで、姿が 2 つ。**
 * スライドには題・列挙・図・表が出て、地の文 (語り) は読み物の側に本文として出る。
 * スライドを開かない読み手とクローラーには、読み物がそのまま届く。
 *
 * 見つからないときは 404 のステータスで「無い」ことを描く (記事・作品と同じ決め)。
 * 読み手に見せない status (`withdrawn` / `draft` / `idea`) も、読み手には同じ 404 になる
 * (記事と同じ。ADR 0040)。
 */
export async function loader({
  request,
  params,
  context,
}: Route.LoaderArgs): Promise<
  ReturnType<typeof data<PageMetaBase & CopyrightData & SlideDetailPageData>>
> {
  const url = new URL(request.url);
  const detail = await loadSlideDetailPage(
    context.get(cloudflareContext).env,
    request,
    params.slug,
    url.origin,
  );
  const base = {
    locale: context.get(localeRouteContext),
    origin: url.origin,
    copyright: resolveCopyrightYears(),
  };

  if (detail.slide === null) return data({ ...base, ...detail }, { status: 404 });

  const headers = new Headers();
  // 管理者にしか見えないスライドは共有キャッシュに載せない。載った写しを剥がす手立ては無い。
  if (detail.privateResponse) {
    for (const [name, value] of Object.entries(PRIVATE_CACHE_HEADERS)) {
      headers.set(name, value);
    }
  }
  // 限定公開は検索エンジンに載せない。meta の robots だけだと、ヘッダーだけを見る収集に
  // 伝わらない。
  if (detail.noindex) {
    headers.set("X-Robots-Tag", "noindex");
  }
  return data({ ...base, ...detail }, { headers });
}

/*
 * loader が付けたヘッダーを文書の応答まで運ぶ。
 *
 * ⚠️ **`headers` を export しないと捨てられる** (articles.$slug.tsx の同じ export を参照)。
 * 管理者向けの `Cache-Control: private, no-store` も限定公開の `X-Robots-Tag` も黙って
 * 消える。
 */
export const headers: Route.HeadersFunction = ({ loaderHeaders, parentHeaders }) => {
  const merged = new Headers(parentHeaders);
  for (const name of ["Cache-Control", "Vary", "X-Robots-Tag"]) {
    const value = loaderHeaders.get(name);
    if (value !== null) merged.set(name, value);
  }
  return merged;
};

export const meta: Route.MetaFunction = ({ loaderData, location }) => {
  const { locale, origin, slide, jsonLd, noindex } = loaderData;
  const translations = translationsFor(locale);

  if (slide === null) {
    return buildPageMeta({
      locale,
      origin,
      pathname: location.pathname,
      title: translations.slides.notFound.title,
      description: translations.slides.notFound.description,
      noindex: true,
    });
  }

  return buildPageMeta({
    locale,
    origin,
    pathname: location.pathname,
    title: slide.title,
    description: slide.summary === "" ? translations.slides.lead : slide.summary,
    imagePath: `/og/slides/${slide.slug}`,
    noindex,
    ...(jsonLd === null ? {} : { jsonLd }),
  });
};

export default function SlideShow({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { slide, mdast, linkCards, author, origin, copyright } = loaderData;

  /*
   * ページに切るのは描くとき。サーバーとブラウザで同じ関数が同じ原文を切るので、
   * 同じデッキになる (切った結果を loader の応答に載せて運ばない)。
   */
  const context = useMemo<SlideContext | null>(() => {
    if (slide === null || mdast === null) return null;
    return {
      deck: paginate(mdast),
      title: slide.title,
      author,
      event: slide.event,
      linkCards,
      siteOrigin: origin,
    };
  }, [slide, mdast, author, linkCards, origin]);

  const transcript = useMemo(() => (mdast === null ? null : withoutPauses(mdast)), [mdast]);

  if (slide === null || mdast === null || context === null || transcript === null) {
    return (
      <AppLayout>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 text-center">
          <h1 className="text-3xl font-bold">{t("slides.notFound.heading")}</h1>
          <p className="mt-4 text-base-content/60">{t("slides.notFound.description")}</p>
          <Link to="/slides" className="btn btn-primary press-control mt-8">
            {t("slides.notFound.backToList")}
          </Link>
        </main>
        <Footer copyright={copyright} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* 刷るのはスライドだけ。サイトの帯と読み物は画面にだけ出す (slide.css)。 */}
      <div className="slide-screen-only">
        <Header />
      </div>
      <main className="slide-print-root mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-10">
        <article className="slide-print-root h-entry flex flex-col gap-10">
          <header className="slide-screen-only flex flex-col gap-2">
            <h1 className="p-name text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {slide.title}
            </h1>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-base-content/60">
              <time className="dt-published" dateTime={slide.publishedOn}>
                {slide.publishedOn}
              </time>
              {/* 発表の場。イベントのページがあれば、そこへ送る。 */}
              {slide.event !== null && (
                <span className="h-event">
                  {slide.event.url === null ? (
                    <span className="p-name">{slide.event.name}</span>
                  ) : (
                    <a className="p-name u-url press-control underline" href={slide.event.url}>
                      {slide.event.name}
                    </a>
                  )}
                </span>
              )}
              {/* 原文。フロントマター込みの Markdown がそのまま取れる。素のリンクで出る。 */}
              <a className="press-control underline" href={`/slides/${slide.slug}.md`}>
                {t("slides.source")}
              </a>
            </p>
          </header>

          <SlideDeck
            context={context}
            labels={{
              previous: t("slides.previous"),
              next: t("slides.next"),
              fullscreen: t("slides.fullscreen"),
              controls: t("slides.controls"),
            }}
          />

          {/*
            読み物。同じ原文を、記事と同じ描き方で上から下へ読める形にしたもの。
            語り (地の文) はここにだけ出る。
          */}
          <section className="slide-screen-only mx-auto w-full max-w-3xl">
            <h2 className="mb-6 text-sm font-semibold uppercase tracking-widest text-base-content/50">
              {t("slides.transcript")}
            </h2>
            <MdastRenderer
              // 「間」の印はスライドの時間の話なので、読み物には出さない。
              node={transcript}
              className="e-content"
              linkCards={linkCards}
              siteOrigin={origin}
            />
          </section>
        </article>
      </main>
      <div className="slide-screen-only">
        <Footer copyright={copyright} />
      </div>
    </AppLayout>
  );
}
