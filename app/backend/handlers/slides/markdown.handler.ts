import { Hono } from "hono";
import { SlideSlug } from "~/backend/domain/slide";
import { contentCacheControlFor } from "~/backend/handlers/articles/content-cache-control";
import { D1SlideQueryRepository } from "~/backend/infra/d1/repositories";
import { R2SlideContentCache } from "~/backend/infra/r2/r2-slide-content-cache";
import { notFoundResponse } from "~/lib/problem-details";

const MARKDOWN_SUFFIX = ".md";
const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

/**
 * スライドの原文 Markdown を返す公開ルータ。認証不要。
 *
 * `/slides/<slug>.md` で、書かれたそのまま (フロントマター込み・画像の相対パスも
 * 書き換えない) を返す。記事の `/articles/<slug>.md` と同じ決め (ADR 0009)。スライドは
 * 原文が意味だけでできている (ADR 0052) ので、原文がそのまま読める発表原稿になる。
 *
 * **`Accept` の交渉はしない。** `.md` で終わらない要求は何も足さずにページ描画へ素通し
 * する (記事のように `Vary: Accept` や `Link` を添えない)。
 *
 * **ルートは `/:file` の 1 本に保つこと。** `/:file{[^/]+[.]md}` のように正規表現で
 * 絞ると Hono の SmartRouter が RegExpRouter を諦めて TrieRouter に落ち、アプリ全体の
 * リクエストが遅いマッチャーを通ることになる (番人は markdown.handler.test.ts)。
 *
 * slug に `.` は使えない (SlideSlug の制約) ため、`<slug>.md` を別のスライドと
 * 取り違える余地はない。`.md` を落とした残りが slug として妥当でなければ 404。
 */
export function createSlideMarkdownRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/:file", async (c, next) => {
    const file = c.req.param("file");
    if (!file.endsWith(MARKDOWN_SUFFIX)) {
      await next();
      return;
    }

    const slug = SlideSlug.parse(file.slice(0, -MARKDOWN_SUFFIX.length));
    if (slug === undefined) return notFoundResponse("slide not found");

    // D1 と R2 は共に slug 依存で互いに独立なので並行に読む。
    const [slide, markdown] = await Promise.all([
      new D1SlideQueryRepository(c.env.D1).findBySlug(slug),
      new R2SlideContentCache(c.env.R2).getSource(slug),
    ]);

    // D1 にメタデータが無い = そもそも存在しないスライド。R2 に写しだけ残っていても
    // 配らない (同期が upsert の手前で落ちた残りかもしれない。#316)。
    if (slide === undefined) return notFoundResponse("slide not found");
    // D1 に在るのに原文が無い = キャッシュ不整合。静かに 404 で隠さず throw する (fail-loud)。
    if (markdown === undefined) {
      throw new Error(`Markdown source cache is missing for an indexed slide: ${slug.toString()}`);
    }

    return new Response(markdown, {
      headers: {
        "Content-Type": MARKDOWN_CONTENT_TYPE,
        // ブラウザで開いたら (可能なら) その場で見せる。保存時のファイル名だけ揃える。
        // 載せるのは検証済みの slug だけ (パスパラメータを素通しすると、改行を含む値で
        // ヘッダー生成が落ちる)。
        "Content-Disposition": `inline; filename="${slug.toString()}${MARKDOWN_SUFFIX}"`,
        "Cache-Control": contentCacheControlFor(c.env),
      },
    });
  });

  return router;
}
