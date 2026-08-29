import { useTranslation } from "react-i18next";
import { data, Link, redirect } from "react-router";
import type { Route } from "./+types/notes.$slug";
import type { CopyrightData } from "~/backend/handlers/copyright-years";
import type { NoteDetailPageData } from "~/backend/handlers/notes/detail.handler";
import type { PageMetaBase } from "~/frontend/lib/page-meta";
import { resolveCopyrightYears } from "~/backend/handlers/copyright";
import { loadNoteDetailPage } from "~/backend/handlers/notes/detail.handler";
import { applyReaction, parseReactionEmoji } from "~/backend/handlers/notes/reaction.handler";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { MdastRenderer } from "~/frontend/components/mdast/mdast-renderer";
import { NoteActions } from "~/frontend/components/note-actions/note-actions";
import { NoteBranches } from "~/frontend/components/note-branches/note-branches";
import { NoteHeader } from "~/frontend/components/note-header/note-header";
import { TableOfContents } from "~/frontend/components/toc/table-of-contents";
import { WebmentionList } from "~/frontend/components/webmention/webmention-list";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { buildPageMeta, translationsFor } from "~/frontend/lib/page-meta";
import { cloudflareContext, localeRouteContext } from "~/frontend/lib/route-context";
import { WEBMENTION_PATH } from "~/lib/constants/webmention";

/**
 * リアクションの押し外し。
 *
 * API (`PUT/DELETE /api/v1/notes/<slug>/reaction`) と同じ処理を、フォームからも
 * 呼べるようにしてある。ページ側を素の `<Form method="post">` で組めば、JS が動かない
 * 環境でもハートを押せる。
 */
export async function action({ request, params, context }: Route.ActionArgs): Promise<Response> {
  const form = await request.formData();
  const raw = form.get("emoji");
  // 値が無ければ取り消し。すでに押しているものは、チップが空を送ってくる。
  const wanted = typeof raw === "string" && raw !== "" ? raw : undefined;
  const emoji = wanted === undefined ? undefined : parseReactionEmoji(wanted);

  /*
   * 読めない絵文字は 400 で断る。JSON API と同じ判定 (parseReactionEmoji) を通し、
   * 扱いも API に揃える。ここを取り消しに倒さないのは、押した人は「付ける」つもりで
   * 押しているためで、読めない値でいまのリアクションを外すと、本人に見えている姿と
   * 記録が食い違う (ADR 0012 の「黙って既定に倒さない」と同じ理由)。
   *
   * 一覧 (`app/lib/emoji/allowed-emoji.ts`) を絞り直すと、旧一覧で押された行がチップ
   * として残るので、読み手からもここを踏める。
   *
   * throw ではなく return するのは、投げると ErrorBoundary のエラー画面になるため。
   * 返せば React Router は action の結果として扱うので、記事はそのまま描かれ、状態
   * だけが 400 になる。
   */
  if (wanted !== undefined && emoji === undefined) {
    return new Response(null, { status: 400 });
  }

  const outcome = await applyReaction(
    context.get(cloudflareContext).env,
    params.slug,
    emoji,
    request.headers.get("cookie"),
  );

  /*
   * 記事が無ければ 404。ここも 400 と同じく return で返す (#269)。
   *
   * 非公開に切り替えた直後、開いたままのタブから押すと踏める。loader が
   * 「見つからない」を throw せず状態として返しているのと揃える。
   */
  if (outcome === undefined) {
    return new Response(null, { status: 404 });
  }

  /*
   * 結果は返さず、記事へ送り返す。JS の有無で経路を分けないためで、押した後の値は
   * どちらの環境でも loader から降ってくる。JS があるときは押した瞬間に画面を先に
   * 動かす (components/reaction) ので、往復の待ちは表に出ない。
   */
  const headers = new Headers();
  if (outcome.setCookie !== "") headers.append("set-cookie", outcome.setCookie);
  return redirect(`/notes/${params.slug}`, { headers, status: 303 });
}

export async function loader({
  request,
  params,
  context,
}: Route.LoaderArgs): Promise<
  ReturnType<typeof data<PageMetaBase & CopyrightData & NoteDetailPageData>>
> {
  const url = new URL(request.url);
  const cloudflare = context.get(cloudflareContext);
  // 読み手のセッション識別子を預け直す cookie を応答に載せる (ADR 0011)。
  // React Router は loader が付けた Set-Cookie を、文書・データどちらの応答にも運ぶ。
  const headers = new Headers();
  const detail = await loadNoteDetailPage(cloudflare.env, params.slug, url.origin, {
    userAgent: request.headers.get("user-agent"),
    cookie: request.headers.get("cookie"),
    waitUntil: (promise) => {
      cloudflare.ctx.waitUntil(promise);
    },
    setCookie: (value) => {
      headers.append("set-cookie", value);
    },
  });
  const base = {
    locale: context.get(localeRouteContext),
    origin: url.origin,
    copyright: resolveCopyrightYears(),
  };

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
    // 受け取れるのはノート宛だけなので、記事ページでだけ受け口を広告する。
    webmentionPath: WEBMENTION_PATH,
  });
};

export default function NoteShow({ loaderData }: Route.ComponentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { copyright } = loaderData;

  if (!loaderData.found) {
    return (
      <AppLayout>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-center">
          <h1 className="text-3xl font-bold">{t("notes.notFound.heading")}</h1>
          <p className="mt-4 text-base-content/60">{t("notes.notFound.description")}</p>
          <Link to="/notes" className="btn btn-primary press-control mt-8">
            {t("notes.notFound.backToList")}
          </Link>
        </main>
        <Footer copyright={copyright} />
      </AppLayout>
    );
  }

  const { note, mdast, related, headings, origin, reactions, linkCards, webmentions } = loaderData;

  return (
    <AppLayout>
      <Header />
      <div className="mx-auto flex w-full max-w-6xl flex-1 justify-center gap-10 px-6 py-10">
        <main className="w-full min-w-0 max-w-3xl h-entry">
          <NoteHeader
            slug={note.slug}
            title={note.title}
            imageUrl={note.imageUrl}
            tags={note.tags}
            publishedOn={note.publishedOn}
            origin={origin}
          />
          {/*
            反応する手と共有する手は、読み終えた足元だけでなく本文の手前にも置く。
            長い記事では、読み始めに共有しようと思っても末尾まで届かないため。
            上下は同じ鍵の fetcher を共有するので、片方で押すともう片方も動く。
          */}
          <NoteActions
            placement="top"
            reactions={reactions.reactions}
            mine={reactions.mine}
            url={`${origin}/notes/${note.slug}`}
            title={note.title}
          />
          <MdastRenderer
            node={mdast}
            linkCards={linkCards}
            className="e-content"
            siteOrigin={origin}
          />
          <NoteActions
            placement="bottom"
            reactions={reactions.reactions}
            mine={reactions.mine}
            url={`${origin}/notes/${note.slug}`}
            title={note.title}
          />
          {/* 届いた反応。1 件も無ければ何も描かない。 */}
          <WebmentionList webmentions={webmentions} />
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
      <Footer copyright={copyright} />
    </AppLayout>
  );
}
