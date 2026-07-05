import { Hono } from "hono";
import { InvalidNoteSlugError, NoteSlug } from "~/backend/domain/note";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";
import { notFoundResponse } from "~/lib/problem-details";

const MAX_AGE_SECONDS = 3600;

/**
 * Cache-Control を決める。BASIC 認証が有効な環境 (staging) では共有キャッシュに
 * 載せると認証バリアを迂回して未認証クライアントへ配信され得るため `private` にし、
 * それ以外 (production 等) では CDN 等でキャッシュできるよう `public` にする。
 * refresh で内容が更新され得るため immutable にはしない。
 */
function cacheControlFor(env: Env): string {
  const isBasicAuthEnabled =
    env.BASIC_AUTH_USER !== undefined && env.BASIC_AUTH_PASS !== undefined;
  const scope = isBasicAuthEnabled ? "private" : "public";
  return `${scope}, max-age=${String(MAX_AGE_SECONDS)}`;
}

/**
 * ノートに紐付く画像アセットを R2 キャッシュから配信する公開ルータ。
 * 認証不要 (index.ts で auth ガードより前にマウントする)。
 *
 * GET /:slug/assets/:path  → R2 の画像を Content-Type 付きで返す。無ければ 404。
 * :path はスラッシュを含むため正規表現パラメータ ({.+}) で丸ごと受ける。
 */
export function createNoteAssetsRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/:slug/assets/:path{.+}", async (c) => {
    let slug: NoteSlug;
    try {
      slug = NoteSlug.create(c.req.param("slug"));
    } catch (error) {
      if (error instanceof InvalidNoteSlugError) {
        return notFoundResponse("asset not found");
      }
      throw error;
    }

    const path = c.req.param("path");
    const cache = new R2NoteContentCache(c.env.R2);
    const asset = await cache.getAsset(slug, path);
    if (asset === undefined) {
      return notFoundResponse("asset not found");
    }

    // Uint8Array はランタイムでは有効な body。型上の ArrayBufferLike の齟齬だけを
    // キャストで解消し、画像全体の再コピーを避ける。
    return new Response(asset.bytes as BodyInit, {
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": cacheControlFor(c.env),
      },
    });
  });

  return router;
}
