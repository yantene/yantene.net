import { Hono } from "hono";
import { contentCacheControlFor } from "~/backend/handlers/notes/content-cache-control";
import { R2LinkCardAssetCache } from "~/backend/infra/r2/r2-link-card-asset-cache";
import { notFoundResponse } from "~/lib/problem-details";

/**
 * リンクカードの画像を R2 から配信する公開ルータ。
 *
 * 相手のドメインから直接読み込むことはできない (`img-src 'self' data:`) ので、refresh の
 * ときに写しておいたものをここから配る。id は URL のダイジェストなので、パスから相手の
 * URL は読み取れない。
 *
 * GET /:id/image, GET /:id/favicon
 */
export function createLinkCardAssetsRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  // id の形をルーティングで縛る。R2 のキーに素の入力を混ぜないための一段目。
  router.get("/:id{[0-9a-f]{32}}/:kind{image|favicon}", async (c) => {
    const id = c.req.param("id");
    const kind = c.req.param("kind");
    const cache = new R2LinkCardAssetCache(c.env.R2);

    const asset =
      kind === "image" ? await cache.getImage(id) : await cache.getFavicon(id);
    if (asset === undefined)
      return notFoundResponse("link card asset not found");

    // Uint8Array はランタイムでは有効な body。型上の齟齬だけをキャストで解消する。
    return new Response(asset.bytes as BodyInit, {
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": contentCacheControlFor(c.env),
      },
    });
  });

  return router;
}
