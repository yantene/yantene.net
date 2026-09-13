import { Hono } from "hono";
import { toPublicArticle, type PublicArticle } from "./article-view";
import { articlePath } from "~/backend/domain/article";
import { D1ArticleQueryRepository } from "~/backend/infra/d1/repositories";
import { feedIdentities, type FeedIdentity, type FeedKind } from "~/lib/feed";

const FEED_LIMIT = 20;
const FEED_AUTHOR = "yantene";
/** 記事が 1 件も無いときの feed updated (Date に依存させない安全側の既定値)。 */
const FALLBACK_UPDATED = "2026-01-01T00:00:00Z";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** "YYYY-MM-DD" を Atom の RFC3339 日時に (UTC 0 時)。 */
function toRfc3339(date: string): string {
  return `${date}T00:00:00Z`;
}

function entryXml(origin: string, article: PublicArticle): string {
  const url = `${origin}${articlePath(article.slug)}`;
  /*
   * カテゴリは記事ごとに変えず `article` で固定する。タグは廃止した (ADR 0029) が、
   * 「これは記事である」という自己記述は残す。microformats2 の p-category と同じ語で、
   * Post Type Discovery が `p-name` と `e-content` から導く型 (article) とも一致する。
   */
  const categories = `    <category term="article"/>`;
  /*
   * `<id>` は記事の URL そのもの。URL を動かせば id も動き、購読者には 1 回だけ全件が
   * 新着に見える (ADR 0032)。それを飲んで、URL と別の識別子を持たない。
   */
  return `  <entry>
    <title>${escapeXml(article.title)}</title>
    <link href="${url}"/>
    <id>${url}</id>
    <published>${toRfc3339(article.publishedOn)}</published>
    <updated>${toRfc3339(article.lastModifiedOn)}</updated>
    <summary>${escapeXml(article.summary)}</summary>
${categories}
  </entry>`;
}

function buildAtom(
  origin: string,
  articles: readonly PublicArticle[],
  identity: FeedIdentity,
): string {
  // feed 全体の updated は最新の更新日時 (エントリの lastModifiedOn の最大)。
  const updated =
    articles
      .map((article) => toRfc3339(article.lastModifiedOn))
      .toSorted((a, b) => a.localeCompare(b))
      .at(-1) ?? FALLBACK_UPDATED;
  const entries = articles.map((article) => entryXml(origin, article)).join("\n");
  const selfUrl = escapeXml(`${origin}${identity.path}`);
  const alternateUrl = escapeXml(`${origin}${identity.alternatePath}`);
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(identity.title)}</title>
  <subtitle>${escapeXml(identity.subtitle)}</subtitle>
  <link href="${selfUrl}" rel="self" type="application/atom+xml"/>
  <link href="${alternateUrl}" rel="alternate" type="text/html"/>
  <id>${alternateUrl}</id>
  <updated>${updated}</updated>
  <author><name>${escapeXml(FEED_AUTHOR)}</name></author>
${entries}
</feed>
`;
}

async function recentArticles(db: D1Database): Promise<readonly PublicArticle[]> {
  const result = await new D1ArticleQueryRepository(db).list({
    limit: FEED_LIMIT,
    offset: 0,
    sortBy: "publishedOn",
    direction: "desc",
  });
  return result.articles.map((article) => toPublicArticle(article));
}

/**
 * その種別の entry を集める。
 *
 * **`notes` と `slides` はまだ中身が無い** (#412 / #415)。コンテンツの型そのものが
 * 無いので、空を返す以外にやりようがない。entry 0 件の Atom は Atom として妥当で、
 * リーダーは「まだ何も出ていないフィード」として扱う。
 *
 * **種別を網羅する形で書くこと。** 「記事以外は空」と書くと、後から足した種別が黙って
 * 記事の流れを配ることになる — 行き先は feedIdentities から自動で生えるので、足した人が
 * ここに気づかないまま公開される。網羅しておけば型が落ちて気づける (fail-loud)。
 *
 * `all` に混ぜ忘れないこと。種別ごとのフィードだけ増えて全体のフィードに出てこないと、
 * 全部を購読しているつもりの人に届かない。
 */
async function entriesFor(kind: FeedKind, db: D1Database): Promise<readonly PublicArticle[]> {
  switch (kind) {
    case "all":
    case "articles":
      return await recentArticles(db);
    case "notes":
    case "slides":
      return [];
    default: {
      const unhandled: never = kind;
      throw new Error(`unknown feed kind: ${String(unhandled)}`);
    }
  }
}

/**
 * Atom フィードの公開ルータ。種別ごとに 1 本ずつ生やす (`/feed.xml` が全体)。
 *
 * 行き先は `~/lib/feed` の {@link feedIdentities} が持つ。ヘッダーの選び場所も同じ表を
 * 読むので、**片方にだけある URL は作れない**。
 *
 * タグは廃止した。`?tag=` を付けても無視してその種別の全体を返す。404 にすると、
 * 購読中のリーダーが「消えたフィード」として扱ってしまう。
 */
export function createFeedRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  for (const identity of feedIdentities) {
    router.get(identity.path, async (c) => {
      const articles = await entriesFor(identity.kind, c.env.D1);
      const origin = new URL(c.req.url).origin;
      return c.body(buildAtom(origin, articles, identity), 200, {
        "Content-Type": "application/atom+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      });
    });
  }

  return router;
}
