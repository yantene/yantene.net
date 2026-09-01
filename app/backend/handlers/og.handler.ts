import { Hono } from "hono";
import { cardHtml, defaultCardHtml, OG_TEMPLATE_VERSION } from "./og-card";
import { NoteSlug } from "~/backend/domain/note";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";
import { notFoundResponse } from "~/lib/problem-details";

/*
 * フル字形の Noto Sans JP (サブセットだと ― 等の記号が豆腐になるため)。
 *
 * ⚠️ **ここを差し替えたら og-card.ts の OG_TEMPLATE_VERSION も上げること。** 蓄えの鍵は
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

/** HTML を OG 画像 (PNG) にして R2 にキャッシュし返す。既存キャッシュがあれば即返す。 */
async function renderAndCache(env: Env, cacheKey: string, html: string): Promise<Response> {
  const cached = await env.R2.get(cacheKey);
  if (cached !== null) {
    return new Response(cached.body, { headers: imageHeaders });
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
  return new Response(bytes, { headers: imageHeaders });
}

/**
 * OG 画像の生成ルータ (公開)。
 * - GET /og/notes/:slug → 記事のブランドカード (imageUrl 有無に関わらず常に生成)
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

  router.get("/notes/:slug", async (c) => {
    const slug = NoteSlug.parse(c.req.param("slug"));
    if (slug === undefined) return notFoundResponse("note not found");

    const note = await new D1NoteQueryRepository(c.env.D1).findBySlug(slug);
    if (note === undefined) return notFoundResponse("note not found");

    const html = cardHtml({
      title: note.title.toString(),
      date: note.publishedOn.toString({ calendarName: "never" }),
    });
    return renderAndCache(
      c.env,
      `og/notes/${slug.toString()}-${note.sourceHash}-${OG_TEMPLATE_VERSION}.png`,
      html,
    );
  });

  return router;
}
