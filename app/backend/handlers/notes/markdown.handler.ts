import { Hono } from "hono";
import {
  contentCacheControlFor,
  NEGOTIATED_CONTENT_CACHE_CONTROL,
} from "./content-cache-control";
import { isMarkdownPreferred } from "./markdown-negotiation";
import { NoteSlug } from "~/backend/domain/note";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";
import { httpStatus } from "~/lib/constants/http-status";
import { notFoundResponse } from "~/lib/problem-details";

const MARKDOWN_SUFFIX = ".md";
const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

/** slug として妥当なら VO を、そうでなければ undefined を返す。 */
/** HTML 応答に添える「Markdown 版もある」の広告 (RFC 8288)。 */
function markdownAlternateLink(slug: NoteSlug): string {
  const target = `/notes/${slug.toString()}${MARKDOWN_SUFFIX}`;
  return `<${target}>; rel="alternate"; type="text/markdown"`;
}

/**
 * R2 の原文キャッシュから Markdown 応答を作る。拡張子つきの URL とネゴシエーション経路で
 * 共有する本体で、違いは Cache-Control だけ (呼び出し側が決める)。
 *
 * slug を VO で受け取るのは、呼び出し側が同じ文字列を `Content-Location` や `Link` に
 * 載せるため。検証済みの値だけがヘッダーに乗るようにしておく (パスパラメータは復号済みで
 * 届くので、素通しすると改行を含む値でヘッダー生成が落ちる)。
 */
async function noteSourceResponse(
  env: Env,
  slug: NoteSlug | undefined,
  options: { readonly cacheControl: string },
): Promise<Response> {
  if (slug === undefined) return notFoundResponse("note not found");

  // D1 と R2 は共に slug 依存で互いに独立なので並行に読む。
  const [note, markdown] = await Promise.all([
    new D1NoteQueryRepository(env.D1).findBySlug(slug),
    new R2NoteContentCache(env.R2).getSource(slug),
  ]);

  // D1 にメタデータが無い = そもそも存在しないノート。
  if (note === undefined) return notFoundResponse("note not found");
  // D1 に在るのに原文が無い = キャッシュ不整合。静かに 404 で隠さず throw する
  // (fail-loud)。実装追加の直後は force refresh で原文を流し込む必要がある。
  if (markdown === undefined) {
    throw new Error(
      `Markdown source cache is missing for an indexed note: ${slug.toString()}`,
    );
  }

  return new Response(markdown, {
    headers: {
      "Content-Type": MARKDOWN_CONTENT_TYPE,
      // ブラウザで開いたら (可能なら) その場で見せる。保存時のファイル名だけ揃える。
      "Content-Disposition": `inline; filename="${slug.toString()}${MARKDOWN_SUFFIX}"`,
      "Cache-Control": options.cacheControl,
    },
  });
}

/**
 * ネゴシエーションで返す Markdown 応答。
 *
 * `Vary: Accept` は 404 にも付ける。この URL の表現が Accept で分かれることは、
 * 見つからなかったときも同じように伝わってよい。`Content-Location` は表現が実際に
 * 在るときだけ — RFC 9110 §8.7 の「いま返した表現の固有 URL」なので 404 には意味がない。
 *
 * ヘッダーは `c.header()` ではなく Response に直接置く。Hono の `set res` は
 * `#preparedHeaders` を引き継がないため、Response を返す経路で `c.header()` を使うと
 * 何も言わずに消える。
 */
async function negotiatedSourceResponse(
  env: Env,
  slug: NoteSlug | undefined,
): Promise<Response> {
  const response = await noteSourceResponse(env, slug, {
    cacheControl: NEGOTIATED_CONTENT_CACHE_CONTROL,
  });

  response.headers.set("Vary", "Accept");
  if (response.status === httpStatus.OK && slug !== undefined) {
    response.headers.set(
      "Content-Location",
      `/notes/${slug.toString()}${MARKDOWN_SUFFIX}`,
    );
  }
  return response;
}

/**
 * ノートの原文 Markdown を返す公開ルータ。認証不要。
 *
 * 1 本の `/:file` で 3 つの入口を捌く。
 *
 * 1. `/notes/<slug>.md` — 拡張子つきの正典 URL (ADR 0009)。Accept は見ない
 *    (拡張子はネゴシエーションに優先する)。表現が 1 つなので `Vary` も付けない。
 * 2. `/notes/<slug>` で Accept が Markdown を名指ししていない — ページ描画へ素通しし、
 *    応答に `Vary: Accept` と Markdown 版への `Link` を足すだけ。
 * 3. `/notes/<slug>` で Accept が Markdown を名指しした — 原文を返す (ADR 0020)。
 *
 * ページではなく「ファイルとしてのノート」を返す 1 と 3 は、React Router へ委譲せず
 * Hono 側で完結させる (ADR 0006)。
 *
 * **ルートは 1 本に保つこと。** `/:file{[^/]+[.]md}` と `/:slug` のように分けると
 * Hono の SmartRouter が RegExpRouter を諦めて TrieRouter に落ち、この 1 ルートのために
 * アプリ全体のリクエストが遅いマッチャーを通ることになる (番人は markdown.handler.test.ts の
 * "keeps the whole app on the faster router")。
 *
 * slug に `.` は使えない (NoteSlug の制約) ため、`<slug>.md` を別のノートと取り違える
 * 余地はない。`.md` を落とした残りが slug として妥当でなければ 404。
 *
 * 本文は正本そのまま (フロントマター込み・画像の相対パスも書き換えない) を返す。
 * 解決済みの URL が要るクライアントには MDAST を返す JSON API がある (ADR 0005)。
 */
export function createNoteMarkdownRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/:file", async (c, next) => {
    const file = c.req.param("file");

    if (file.endsWith(MARKDOWN_SUFFIX)) {
      return noteSourceResponse(
        c.env,
        NoteSlug.parse(file.slice(0, -MARKDOWN_SUFFIX.length)),
        { cacheControl: contentCacheControlFor(c.env) },
      );
    }

    if (!isMarkdownPreferred(c.req.header("Accept"))) {
      await next();
      // 応答が確定した後に足す。immutable な応答でも `c.header` は作り直してくれる
      // (`c.res.headers.append()` は TypeError になる)。
      c.header("Vary", "Accept", { append: true });

      // 記事が実際に描けたときだけ Markdown 版を広告する。見つからなかったページ
      // (loader が status 404 を返す) にまで付けると、`rel=alternate` を辿る相手に
      // 必ず 404 になる URL を教えることになる。ここで在否を確かめ直すと D1 の読み取りが
      // ページ表示のたびに 1 回増えるので、下流が出した status をそのまま使う。
      const slug = NoteSlug.parse(file);
      if (slug !== undefined && c.res.ok) {
        c.header("Link", markdownAlternateLink(slug), { append: true });
      }
      return;
    }

    return negotiatedSourceResponse(c.env, NoteSlug.parse(file));
  });

  return router;
}
