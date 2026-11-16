import { Hono } from "hono";
import { SlideSlug } from "~/backend/domain/slide";
import { contentCacheControlFor } from "~/backend/handlers/articles/content-cache-control";
import { D1SlideQueryRepository } from "~/backend/infra/d1/repositories";
import { R2SlideContentCache } from "~/backend/infra/r2/r2-slide-content-cache";
import { notFoundResponse } from "~/lib/problem-details";

/**
 * スライドに紐付くアセット (本文に貼った図など) を R2 キャッシュから配信する公開ルータ。
 *
 * GET /:slug/assets/:path  → R2 のファイルを Content-Type 付きで返す。無ければ 404。
 * :path はスラッシュを含むため正規表現パラメータ ({.+}) で丸ごと受ける。
 *
 * **R2 に在ることを配信の条件にしない。D1 の行も確かめる** (記事・作品と同じ扱い)。
 * 同期がアセットの書き込みまで進んで upsert の手前で落ちると、D1 に行の無い絵が R2 に
 * 残る。掃除は D1 の行を辿るので届かず、`slides/<slug>.md` を消しても絵だけ配られ
 * 続けることになる (#316)。
 */
export function createSlideAssetsRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/:slug/assets/:path{.+}", async (c) => {
    const slug = SlideSlug.parse(c.req.param("slug"));
    if (slug === undefined) return notFoundResponse("asset not found");
    const path = c.req.param("path");

    // D1 と R2 は互いに独立なので並行に読む。
    const [slide, asset] = await Promise.all([
      new D1SlideQueryRepository(c.env.D1).findBySlug(slug),
      new R2SlideContentCache(c.env.R2).getAsset(slug, path),
    ]);

    if (slide === undefined || asset === undefined) {
      return notFoundResponse("asset not found");
    }

    // Uint8Array はランタイムでは有効な body。型上の ArrayBufferLike の齟齬だけを
    // キャストで解消し、画像全体の再コピーを避ける。
    return new Response(asset.bytes as BodyInit, {
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": contentCacheControlFor(c.env),
      },
    });
  });

  return router;
}
