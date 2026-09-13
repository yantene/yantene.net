import { Hono } from "hono";
import { cardHtml, defaultCardHtml, OG_TEMPLATE_VERSION } from "./og-card";
import { ArticleSlug, shouldTellRobotsNoindex } from "~/backend/domain/article";
import { D1ArticleQueryRepository } from "~/backend/infra/d1/repositories";
import { notFoundResponse } from "~/lib/problem-details";

/*
 * フル字形の Noto Sans JP (サブセットだと ― 等の記号が豆腐になるため)。
 *
 * ⚠️ **ここを差し替えたら og-card.ts の OG_TEMPLATE_VERSION も上げること。** 蓄えのキーは
 * その版だけを見ているので、上げないと既に描いてあるカードが古い字のまま配られ続ける。
 */
const FONT_KEY = "og/fonts/noto-sans-jp-700-full.ttf";

/** isolate 内でフォントを使い回す (R2 からの再取得を避ける)。FONT_KEY をキーにして
 *  フォント差し替え時に warm isolate が古い font を握り続けないようにする。 */
const fontCache: { key?: string; data?: ArrayBuffer } = {};

async function loadFont(env: Env): Promise<ArrayBuffer> {
  if (fontCache.key === FONT_KEY && fontCache.data !== undefined) {
    return fontCache.data;
  }
  const object = await env.R2.get(FONT_KEY);
  if (object === null) {
    throw new Error(`OG font not found in R2: ${FONT_KEY}`);
  }
  fontCache.data = await object.arrayBuffer();
  fontCache.key = FONT_KEY;
  return fontCache.data;
}

const imageHeaders = {
  "Content-Type": "image/png",
  "Cache-Control": "public, max-age=31536000, immutable",
};

/**
 * HTML を OG 画像 (PNG) にして R2 にキャッシュし返す。既存キャッシュがあれば即返す。
 *
 * `extraHeaders` は限定公開の記事に `X-Robots-Tag: noindex` を足すためのもの。絵には
 * 記事の題が焼き込んであるので、画像検索に出ると題と存在が漏れる (ADR 0040)。
 */
async function renderAndCache(
  env: Env,
  cacheKey: string,
  html: string,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<Response> {
  const headers = { ...imageHeaders, ...extraHeaders };
  const cached = await env.R2.get(cacheKey);
  if (cached !== null) {
    return new Response(cached.body, { headers });
  }
  // workers-og は WASM を含むため動的 import する (トップレベル import だと
  // index.ts を読むだけで WASM ロードが走り、テスト環境が壊れる)。
  const { ImageResponse } = await import("workers-og");
  const font = await loadFont(env);
  const image = new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts: [{ name: "Noto Sans JP", data: font, weight: 700, style: "normal" }],
  });
  const bytes = await image.arrayBuffer();
  await env.R2.put(cacheKey, bytes, {
    httpMetadata: { contentType: "image/png" },
  });
  return new Response(bytes, { headers });
}

/**
 * OG 画像の生成ルータ (公開)。
 * - GET /og/articles/:slug → 記事のブランドカード (imageUrl 有無に関わらず常に生成)
 * - GET /og/default     → サイト共通のデフォルトカード
 * R2 にキャッシュし、記事更新やテンプレ版変更で自動再生成する。
 *
 * 見つからないときは RFC 9457 の Problem Details で返す。返すものが画像であっても、
 * 返せなかったときの形はサイト全体で 1 つに揃える。同じく画像を配る
 * `handlers/link-cards/assets.handler.ts` も同じ形で断る。
 */
export function createOgRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/default", (c) =>
    renderAndCache(c.env, `og/default-${OG_TEMPLATE_VERSION}.png`, defaultCardHtml()),
  );

  router.get("/articles/:slug", async (c) => {
    const slug = ArticleSlug.parse(c.req.param("slug"));
    if (slug === undefined) return notFoundResponse("article not found");

    const article = await D1ArticleQueryRepository.forReaders(c.env.D1).findBySlug(slug);
    if (article === undefined) return notFoundResponse("article not found");

    const html = cardHtml({
      title: article.title.toString(),
      date: article.publishedOn.toString({ calendarName: "never" }),
    });
    // キーに入るのは絵を決めるもの (スラグ・版・型) だけ。改名前の `og/notes/` は読まず、手で消す。
    return renderAndCache(
      c.env,
      `og/articles/${slug.toString()}-${article.sourceHash}-${OG_TEMPLATE_VERSION}.png`,
      html,
      // 限定公開の絵は検索エンジンに載せない。題が焼き込んであるので、画像検索に
      // 出ると題と存在が漏れ、そこから記事に辿り着ける (ADR 0040)。
      shouldTellRobotsNoindex(article.status) ? { "X-Robots-Tag": "noindex" } : {},
    );
  });

  return router;
}
