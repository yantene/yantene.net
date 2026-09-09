import { Hono } from "hono";
import { contentCacheControlFor } from "./content-cache-control";
import { NoteSlug } from "~/backend/domain/note";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";
import { notFoundResponse } from "~/lib/problem-details";

/**
 * ノートに紐付く画像アセットを R2 キャッシュから配信する公開ルータ。
 *
 * GET /:slug/assets/:path  → R2 の画像を Content-Type 付きで返す。無ければ 404。
 * :path はスラッシュを含むため正規表現パラメータ ({.+}) で丸ごと受ける。
 *
 * **R2 に在ることを配信の条件にしない。D1 の行も確かめる** (原文を配る
 * markdown.handler.ts と同じ扱い)。同期が `cacheAssets` まで進んで `upsert` の手前で
 * 落ちると、D1 に行の無い記事の絵が R2 に残る。掃除は D1 の行を辿るので届かず、
 * 書き手が非公開にしても絵だけ配られ続けていた (#316)。
 */
export function createNoteAssetsRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/:slug/assets/:path{.+}", async (c) => {
    const slug = NoteSlug.parse(c.req.param("slug"));
    if (slug === undefined) return notFoundResponse("asset not found");

    const path = c.req.param("path");
    // D1 と R2 は共に slug 依存で互いに独立なので並行に読む。
    const [note, asset] = await Promise.all([
      new D1NoteQueryRepository(c.env.D1).findBySlug(slug),
      new R2NoteContentCache(c.env.R2).getAsset(slug, path),
    ]);

    // 記事として索引に無いなら、その絵も無いことにする。原文と揃えて、在ることも
    // 教えない (存在の推測を許さない)。
    if (note === undefined || asset === undefined) {
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
