import { Hono } from "hono";
import { contentCacheControlFor } from "./content-cache-control";
import { ArticleSlug, shouldTellRobotsNoindex } from "~/backend/domain/article";
import { privateCacheHeadersFor, resolveArticleReadAccess } from "./article-read-access";
import { R2ArticleContentCache } from "~/backend/infra/r2/r2-article-content-cache";
import { notFoundResponse } from "~/lib/problem-details";

/**
 * 記事に紐付く画像アセットを R2 キャッシュから配信する公開ルータ。
 *
 * GET /:slug/assets/:path  → R2 の画像を Content-Type 付きで返す。無ければ 404。
 * :path はスラッシュを含むため正規表現パラメータ ({.+}) で丸ごと受ける。
 *
 * **R2 に在ることを配信の条件にしない。D1 の行も確かめる** (原文を配る
 * markdown.handler.ts と同じ扱い)。同期が `cacheAssets` まで進んで `upsert` の手前で
 * 落ちると、D1 に行の無い記事の絵が R2 に残る。掃除は D1 の行を辿るので届かず、
 * 書き手が非公開にしても絵だけ配られ続けていた (#316)。
 */
export function createArticleAssetsRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/:slug/assets/:path{.+}", async (c) => {
    const slug = ArticleSlug.parse(c.req.param("slug"));
    if (slug === undefined) return notFoundResponse("asset not found");

    const path = c.req.param("path");

    /*
     * 管理者なら全 status。**下書きをプレビューするときに絵だけ 404 にならないよう、
     * ここも記事ページと同じ判定を通す** (ADR 0040)。
     *
     * R2 の取得と並べる。誰なのかを見るのに置き場を引くのは cookie を持つ人だけだが、
     * 直列に置くと**画像 1 枚ごとにその往復が R2 の前に挟まる**。
     */
    const [access, asset] = await Promise.all([
      resolveArticleReadAccess(c.env, c.req.raw),
      new R2ArticleContentCache(c.env.R2).getAsset(slug, path),
    ]);
    const article = await access.query.findBySlug(slug);

    // 記事として索引に無いなら、その絵も無いことにする。原文と揃えて、在ることも
    // 教えない (存在の推測を許さない)。
    if (article === undefined || asset === undefined) {
      return notFoundResponse("asset not found");
    }

    // Uint8Array はランタイムでは有効な body。型上の ArrayBufferLike の齟齬だけを
    // キャストで解消し、画像全体の再コピーを避ける。
    return new Response(asset.bytes as BodyInit, {
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": contentCacheControlFor(c.env),
        // 限定公開の絵も検索エンジンに載せない (ADR 0040)。画像検索に出ると、
        // そこから記事へ辿り着けてしまう。
        ...(shouldTellRobotsNoindex(article.status) ? { "X-Robots-Tag": "noindex" } : {}),
        // 管理者にしか見えない記事の絵は共有キャッシュに載せない (ADR 0040)。
        ...privateCacheHeadersFor(access, article.status),
      },
    });
  });

  return router;
}
