/* eslint-disable no-secrets/no-secrets -- インライン SVG / CSS の高エントロピー文字列を秘匿情報と誤検知するため無効化 (このファイルは秘密を含まない)。 */
import { Hono } from "hono";
import { NoteSlug } from "~/backend/domain/note";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

// フル字形の Noto Sans JP (サブセットだと ― 等の記号が豆腐になるため)。
const FONT_KEY = "og/fonts/noto-sans-jp-700-full.ttf";
const TITLE_MAX = 56;
/** カードのデザイン版。テンプレート/フォントを変えたら上げると全 OG が再生成される。 */
const OG_TEMPLATE_VERSION = "v6";

/** yantene アイコン (data URI で OG カードに埋め込む)。 */
const YANTENE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 67.733 67.733"><g transform="translate(-121.17 -27.445)"><path d="M73.685 39.527h135.467v67.733H73.685z" style="fill:#f8e5d6;fill-opacity:1;stroke-width:7.26443;stroke-linecap:square;stroke-linejoin:round;paint-order:stroke fill markers;stop-color:#000"/><path d="M73.685-28.206h135.467v67.733H73.685z" style="fill:#c9ab80;fill-opacity:1;stroke-width:7.26443;stroke-linecap:square;stroke-linejoin:round;paint-order:stroke fill markers;stop-color:#000"/><circle cx="88.27" cy="-72.048" r="39.677" style="fill:#c9ab80;fill-opacity:1;stroke-width:6.78952;stroke-linecap:square;stroke-linejoin:round;paint-order:stroke fill markers;stop-color:#000" transform="rotate(45)"/><circle cx="167.625" cy="-72.048" r="39.677" style="fill:#f8e5d6;fill-opacity:1;stroke-width:6.78952;stroke-linecap:square;stroke-linejoin:round;paint-order:stroke fill markers;stop-color:#000" transform="rotate(45)"/><path d="M159.46 46.99a14.817 14.74 0 0 1 12.379-6.118 14.817 14.74 0 0 1 12.066 6.708M125.887 41.94a14.817 14.74 0 0 1 13.395-3.669 14.817 14.74 0 0 1 10.561 8.981" style="fill:none;fill-opacity:1;stroke:#78a2d2;stroke-width:4.23333;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1;paint-order:stroke fill markers;stop-color:#000"/><path d="m128.378 51.872 16.39 5.9-16.08 7.858M180.139 53.64l-16.668 5.057 15.658 8.666" style="fill:none;stroke:#78a2d2;stroke-width:4.23334;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"/><path d="M143.31 78.073c-3.662 3.393-2.03 25.136 6.81 26.34 8.842 1.204 15.08-18.378 12.73-22.413s-15.876-7.32-19.54-3.927" style="fill:#d47d7d;fill-opacity:1;stroke:none;stroke-width:.529166px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1"/></g></svg>`;
const ICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(YANTENE_ICON_SVG)}`;

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** OG カードの HTML (Satori 制約: flex レイアウトのみ)。 */
function cardHtml(params: {
  title: string;
  date: string;
  tags: readonly string[];
}): string {
  const title = escapeHtml(truncate(params.title, TITLE_MAX));
  const tagChips = params.tags
    .slice(0, 4)
    .map(
      (tag) =>
        `<div style="display:flex;background:#f1efec;color:#7a7269;font-size:22px;padding:6px 18px;border-radius:999px;margin-right:12px;">${escapeHtml(tag)}</div>`,
    )
    .join("");

  return `
    <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#ffffff;font-family:'Noto Sans JP';">
      <div style="display:flex;height:14px;width:100%;background:linear-gradient(90deg,#c9f2ff,#ffad31,#28324f,#db6a00,#c9f2ff);"></div>
      <div style="display:flex;flex-direction:column;flex:1;justify-content:space-between;padding:72px 80px;">
        <div style="display:flex;font-size:62px;font-weight:700;color:#1a1a1a;line-height:1.35;">${title}</div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;">
          <div style="display:flex;flex-direction:column;">
            <div style="display:flex;font-size:26px;color:#999999;">${escapeHtml(params.date)}</div>
            <div style="display:flex;margin-top:16px;">${tagChips}</div>
          </div>
          <div style="display:flex;align-items:center;">
            <img src="${ICON_DATA_URI}" width="56" height="56" style="border-radius:12px;margin-right:16px;" />
            <div style="display:flex;font-size:34px;font-weight:700;color:#c9ab80;">yantene</div>
          </div>
        </div>
      </div>
    </div>`;
}

/**
 * OG 画像の生成ルータ (公開)。`GET /og/notes/:slug` が 1200x630 の PNG を返す。
 * imageUrl の有無に関わらず常にブランドカードを生成する。R2 にキャッシュし、
 * 記事内容が変わったら sourceHash 込みのキーで自動的に再生成される。
 */
export function createOgRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/notes/:slug", async (c) => {
    let slug: NoteSlug;
    try {
      slug = NoteSlug.create(c.req.param("slug"));
    } catch {
      return c.notFound();
    }

    const note = await new D1NoteQueryRepository(c.env.D1).findBySlug(slug);
    if (note === undefined) return c.notFound();

    const cacheKey = `og/notes/${slug.toString()}-${note.sourceHash}-${OG_TEMPLATE_VERSION}.png`;
    const cached = await c.env.R2.get(cacheKey);
    const headers = {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    };
    if (cached !== null) {
      return new Response(cached.body, { headers });
    }

    // workers-og は WASM を含むため動的 import する (トップレベル import だと
    // index.ts を読むだけで WASM ロードが走り、テスト環境が壊れる)。
    const { ImageResponse } = await import("workers-og");
    const font = await loadFont(c.env);
    const html = cardHtml({
      title: note.title.toString(),
      date: note.publishedOn.toString({ calendarName: "never" }),
      tags: note.tags.map((tag) => tag.toString()),
    });
    const image = new ImageResponse(html, {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Noto Sans JP", data: font, weight: 700, style: "normal" },
      ],
    });

    const bytes = await image.arrayBuffer();
    await c.env.R2.put(cacheKey, bytes, {
      httpMetadata: { contentType: "image/png" },
    });
    return new Response(bytes, { headers });
  });

  return router;
}
