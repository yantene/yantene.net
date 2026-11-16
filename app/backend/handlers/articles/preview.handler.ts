import { Hono } from "hono";
import { contentCacheControlFor } from "./content-cache-control";
import type { Article } from "~/backend/domain/article";
import { ArticleNotFoundError, ArticleSlug } from "~/backend/domain/article";
import { D1ArticleQueryRepository } from "~/backend/infra/d1/repositories";

/**
 * 本文の内部リンクに添えるプレビュー。リンク先が何の記事かを一目で伝えるだけのもの。
 *
 * カバー画像の URL も返すが、チップには描いていない (載せると重くなり、チップの大きさも
 * 安定しない)。
 */
export interface ArticlePreview {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly publishedOn: string;
  readonly imageUrl: string | null;
}

function toArticlePreview(article: Article): ArticlePreview {
  return {
    slug: article.slug.toJSON(),
    title: article.title.toJSON(),
    summary: article.summary,
    publishedOn: article.publishedOn.toString({ calendarName: "never" }),
    imageUrl: article.imageUrl?.toJSON() ?? null,
  };
}

/**
 * 記事のプレビューの公開 JSON API ルータ。認証不要。
 * GET /:slug/preview → 題・要約・公開日・カバー画像。見えない記事は ArticleNotFoundError (→ 404)。
 *
 * **読み取り口は `forReaders` で固定する。管理者でも分けない** (ADR 0049)。
 * この応答は公開のキャッシュに載る。管理者に下書きの題を返すと、同じ URL を引いた
 * 読み手にそのまま配られ、載った先で剥がす手立てが無い。だから誰が引いているか
 * (セッション) を見に行くこと自体をしない。記事ページのように
 * `resolveArticleReadAccess` を通さないのはそのため。
 *
 * `unlisted` は返す。`findBySlug` が通すのは「URL を知っていれば読める」記事で、
 * 記事ページも記事の JSON API も読み手に返している。プレビューが出るのは本文に
 * リンクが張られているときなので、URL は既に明かされている。
 */
export function createArticlePreviewApiRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/:slug/preview", async (c) => {
    const slugParam = c.req.param("slug");
    const slug = ArticleSlug.parse(slugParam);
    if (slug === undefined) throw new ArticleNotFoundError(slugParam);

    const article = await D1ArticleQueryRepository.forReaders(c.env.D1).findBySlug(slug);
    if (article === undefined) throw new ArticleNotFoundError(slugParam);

    return c.json(toArticlePreview(article), {
      headers: { "Cache-Control": contentCacheControlFor(c.env) },
    });
  });

  return router;
}
