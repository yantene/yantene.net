import { Hono } from "hono";
import { InvalidNoteSlugError, NoteSlug } from "~/backend/domain/note";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";
import { notFoundResponse } from "~/lib/problem-details";

// 画像アセットのキャッシュ有効期間。refresh で内容が更新され得るため immutable には
// せず、そこそこの期間だけキャッシュさせる。
const CACHE_CONTROL = "public, max-age=3600";

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

    // ArrayBuffer 裏付けの新しいビューにして BodyInit の型制約を満たす。
    return new Response(new Uint8Array(asset.bytes), {
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": CACHE_CONTROL,
      },
    });
  });

  return router;
}
