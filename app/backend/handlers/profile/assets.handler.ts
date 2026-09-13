import { Hono } from "hono";
import { contentCacheControlFor } from "~/backend/handlers/articles/content-cache-control";
import { D1ProfileQueryRepository } from "~/backend/infra/d1/repositories";
import { R2ProfileContentCache } from "~/backend/infra/r2/r2-profile-content-cache";
import { notFoundResponse } from "~/lib/problem-details";

/**
 * プロフィールに紐付くアセット (顔写真など) を R2 キャッシュから配信する公開ルータ。
 *
 * GET /assets/:path  → R2 のファイルを Content-Type 付きで返す。無ければ 404。
 * :path はスラッシュを含むため正規表現パラメータ ({.+}) で丸ごと受ける。
 *
 * **R2 に在ることを配信の条件にしない。D1 の行も確かめる** (記事のアセットと同じ扱い)。
 * 同期がアセットの書き込みまで進んで upsert の手前で落ちると、D1 に行の無い顔写真が
 * R2 に残る。掃除は D1 の行を辿るので届かず、`profile.md` を消しても絵だけ配られ
 * 続けることになる (#316)。
 */
export function createProfileAssetsRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/assets/:path{.+}", async (c) => {
    const path = c.req.param("path");
    // D1 と R2 は互いに独立なので並行に読む。
    const [sourceHash, asset] = await Promise.all([
      new D1ProfileQueryRepository(c.env.D1).findSourceHash(),
      new R2ProfileContentCache(c.env.R2).getAsset(path),
    ]);

    if (sourceHash === undefined || asset === undefined) {
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
