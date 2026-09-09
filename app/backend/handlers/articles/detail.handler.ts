import { Hono } from "hono";
import { toArticleDetail } from "./article-detail-view";
import { buildPayload, type ReactionsPayload } from "./reaction.handler";
import { extractHeadings } from "./toc-headings";
import { recordArticleView, type ArticleViewRecording } from "./view-recording";
import type { ArticleDetail, PublicArticleMeta } from "./article-detail-view";
import type { Article } from "~/backend/domain/article";
import type { TocHeading } from "./toc-headings";
import type { Root } from "mdast";
import type { LinkCardMap } from "~/backend/handlers/link-cards/link-card-view";
import type { WebmentionGroups } from "~/backend/handlers/webmentions/webmention-view";
import { LinkCardUrl } from "~/backend/domain/link-card";
import { articlePath, ArticleNotFoundError, ArticleSlug } from "~/backend/domain/article";
import { entityId } from "~/backend/domain/shared";
import { isBlockedSource } from "~/backend/domain/webmention";
import { toLinkCardMap } from "~/backend/handlers/link-cards/link-card-view";
import { toPublicArticle, type PublicArticle } from "~/backend/handlers/article-view";
import { readSessionId } from "~/backend/handlers/session-cookie";
import { toWebmentionGroups } from "~/backend/handlers/webmentions/webmention-view";
import {
  D1LinkCardQueryRepository,
  D1ArticleEmbeddingQueryRepository,
  D1ArticleQueryRepository,
  D1WebmentionBlocklist,
  D1WebmentionQueryRepository,
} from "~/backend/infra/d1/repositories";
import { KvSessionQueryRepository } from "~/backend/infra/kv/repositories";
import { R2ArticleContentCache } from "~/backend/infra/r2/r2-article-content-cache";
import { collectBareLinkUrls } from "~/lib/link-card/bare-link";

/** 記事末に出す関連記事の最大件数。 */
const RELATED_LIMIT = 6;

/**
 * slug から記事詳細 (メタデータ + キャッシュ済み MDAST) を読む。
 *
 * - D1 にメタデータが無い = そもそも存在しない記事 → undefined (呼び出し側で 404)。
 * - D1 に在るのに R2 の MDAST が無い = キャッシュ不整合。静かに 404 で隠さず throw する
 *   (fail-loud)。公開済みの記事が消えて見えるより、不整合を表面化させる。
 *
 * D1 と R2 は共に slug 依存で互いに独立なので並行に読む。
 */
/** 内部用。API に出す ArticleDetail に加えて、閲覧の記録に要る id を併せて返す。 */
interface ResolvedArticle {
  readonly detail: ArticleDetail;
  readonly articleId: string;
}

async function loadArticleDetail(
  env: Env,
  slug: ArticleSlug,
): Promise<ResolvedArticle | undefined> {
  const [article, mdast] = await Promise.all([
    new D1ArticleQueryRepository(env.D1).findBySlug(slug),
    new R2ArticleContentCache(env.R2).getMdast(slug),
  ]);
  if (article === undefined) return undefined;
  if (mdast === undefined) {
    throw new Error(`MDAST cache is missing for an indexed article: ${slug.toString()}`);
  }
  const linkCards = await loadLinkCards(env, mdast as Root);
  return { detail: toArticleDetail(article, mdast, linkCards), articleId: article.id };
}

/**
 * 本文に貼られたむき出しの URL のカードを引く。
 *
 * カードが無い URL は表に載らず、描画側は素のリンクのまま描く。ここで取りに行くことは
 * しない。通常のリクエストで外部を叩かないため (ADR 0004)、取得は refresh の仕事。
 */
async function loadLinkCards(env: Env, mdast: Root): Promise<LinkCardMap> {
  const urls = collectBareLinkUrls(mdast);
  if (urls.length === 0) return {};

  const cards = await new D1LinkCardQueryRepository(env.D1).findByUrls(
    urls.map((url) => LinkCardUrl.create(url)),
  );
  return toLinkCardMap(cards);
}

/** slug パラメータを解決して詳細をロードする共通処理 (API / ページで共有)。 */
async function resolveDetail(env: Env, slugParam: string): Promise<ResolvedArticle | undefined> {
  const slug = ArticleSlug.parse(slugParam);
  return slug === undefined ? undefined : loadArticleDetail(env, slug);
}

/**
 * 記事詳細の公開 JSON API ルータ。認証不要。
 * GET /:slug → メタデータ + MDAST。存在しなければ ArticleNotFoundError (→ 404)。
 */
export function createArticleDetailApiRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/:slug", async (c) => {
    const slugParam = c.req.param("slug");
    const resolved = await resolveDetail(c.env, slugParam);
    if (resolved === undefined) throw new ArticleNotFoundError(slugParam);
    return c.json(resolved.detail);
  });

  return router;
}

/**
 * 押されているリアクションと、この読み手が押しているものを読む。
 *
 * cookie を持っていない相手には「誰も押していない」を返すだけで、セッションは起こさない。
 * ページを開いただけの人にまで識別子を配る必要はない (発行は押したときに API が行う)。
 */
async function loadReactions(
  env: Env,
  articleId: string,
  slug: ArticleSlug,
  cookie: string | null,
): Promise<ReactionsPayload> {
  const sessionId = readSessionId(cookie);
  if (sessionId === undefined) return buildPayload(env, articleId, undefined);

  const session = await new KvSessionQueryRepository(env.SESSIONS).findById(sessionId);
  return buildPayload(env, articleId, session?.reactionFor(slug)?.emoji);
}

export type ArticleDetailPageData =
  | { readonly found: false }
  | {
      readonly found: true;
      readonly article: PublicArticleMeta;
      /** パース済み MDAST。loader を通して渡すため具体型で持つ (unknown だと型が落ちる)。 */
      readonly mdast: Root;
      /** 本文に貼られたむき出しの URL のカード。URL をキーに引く。 */
      readonly linkCards: LinkCardMap;
      /**
       * 受け取った Webmention。顔だけ並べるものと本文を読ませるものに分けてある。
       *
       * SSR の時点で確定させる。クライアントで問い直して描き分けると
       * hydration mismatch になる (#156)。
       */
      readonly webmentions: WebmentionGroups;
      readonly related: readonly PublicArticle[];
      readonly headings: readonly TocHeading[];
      /**
       * 押されているリアクションと、この読み手が押しているもの。
       *
       * ページの描画に混ぜて返すのは、SSR の時点で「自分が押したか」を確定させるため。
       * クライアントで問い直して描き分けると hydration mismatch になる (#156)。
       */
      readonly reactions: ReactionsPayload;
      /** schema.org BlogPosting (検索エンジン向け構造化データ)。絶対 URL で構築する。 */
      readonly jsonLd: Record<string, unknown>;
    };

/**
 * 関連記事を、本文から作ったベクトルの近さで引く (ADR 0028)。
 *
 * 近さの表が持つのは slug だけなので、記事の中身は改めてまとめて引く。並び順は
 * `findBySlugs` が保証しないため、近い順に並べ直す。
 *
 * **タグ版へは戻さない。** ベクトルがまだ無い記事 (公開した直後、refresh が 1 回の上限に
 * 掛かったとき) はここが空になるが、代わりにタグで並べると「なぜこの並びなのか」が
 * 記事ごとに変わってしまう。次の refresh で入るので、空のまま出す。
 */
async function loadRelated(
  env: Env,
  query: D1ArticleQueryRepository,
  slug: ArticleSlug,
): Promise<readonly Article[]> {
  const slugs = await new D1ArticleEmbeddingQueryRepository(env.D1).findRelatedSlugs(
    slug,
    RELATED_LIMIT,
  );
  if (slugs.length === 0) return [];
  const articles = await query.findBySlugs(slugs);
  const bySlug = new Map(articles.map((article) => [article.slug.toString(), article] as const));
  return slugs.map((item) => bySlug.get(item)).filter((article) => article !== undefined);
}

/**
 * 記事詳細ページのデータを読む (Composition Root)。認証不要。
 * 存在しない slug は throw せず `found: false` を返し、呼び出し側 (loader) が
 * 404 ステータスで not-found 状態のページを描画する。
 */
export async function loadArticleDetailPage(
  env: Env,
  slugParam: string,
  origin: string,
  recording: ArticleViewRecording | null,
): Promise<ArticleDetailPageData> {
  const resolved = await resolveDetail(env, slugParam);
  if (resolved === undefined) return { found: false };

  const detail = resolved.detail;
  // 読まれた記事として数える。応答を返し終えてから走るので、描画は待たされない。
  if (recording !== null) {
    recordArticleView(env, { id: resolved.articleId, slug: detail.article.slug }, recording);
  }

  const query = new D1ArticleQueryRepository(env.D1);
  const slug = ArticleSlug.create(detail.article.slug);
  const [related, reactions, webmentions, blockedHosts] = await Promise.all([
    loadRelated(env, query, slug),
    loadReactions(env, resolved.articleId, slug, recording?.cookie ?? null),
    // 内部 id はここまで素の文字列で運んでいる。リポジトリ境界でブランド型に戻す。
    new D1WebmentionQueryRepository(env.D1).listByArticleId(
      entityId<"Article">(resolved.articleId),
    ),
    new D1WebmentionBlocklist(env.D1).listBlockedHosts(),
  ]);

  /*
   * 止めている送信元を落とす。
   *
   * 受信の時点でも弾いており、止めた後に再送が来れば行ごと消える。それでも読むときに
   * もう一度通すのは、**止める前に届いていた行が残っている**ため。表を直に書き換えて
   * 止めることもあるので、出す手前にも同じ判定を置く。
   */
  const shown = webmentions.filter(
    (webmention) => !isBlockedSource(webmention.source, blockedHosts),
  );

  const mdast = detail.mdast as Root;
  return {
    found: true,
    article: detail.article,
    mdast,
    linkCards: detail.linkCards,
    webmentions: toWebmentionGroups(shown),
    related: related.map((article) => toPublicArticle(article)),
    headings: extractHeadings(mdast),
    reactions,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: detail.article.title,
      description: detail.article.summary,
      image: `${origin}/og/articles/${detail.article.slug}`,
      datePublished: detail.article.publishedOn,
      dateModified: detail.article.lastModifiedOn,
      author: { "@type": "Person", name: "yantene", url: `${origin}/` },
      publisher: { "@type": "Person", name: "yantene" },
      mainEntityOfPage: `${origin}${articlePath(detail.article.slug)}`,
    },
  };
}
