import { Hono } from "hono";
import { toPublicArticle, type PublicArticle } from "./article-view";
import { toPublicSlide, type PublicSlide } from "./slides/slide-view";
import { articlePath } from "~/backend/domain/article";
import { slidePath } from "~/backend/domain/slide";
import { D1ArticleQueryRepository, D1SlideQueryRepository } from "~/backend/infra/d1/repositories";
import { loadProfile } from "~/backend/handlers/profile/pages.handler";
import { FALLBACK_PROFILE_NAME } from "~/lib/profile-fallback";
import { feedIdentities, type FeedIdentity, type FeedKind } from "~/lib/feed";

const FEED_LIMIT = 20;
/** entry が 1 件も無いときの feed updated (Date に依存させない安全側の既定値)。 */
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

/**
 * フィードの entry 1 件。種別 (記事・スライド) によらない形に均したもの。
 *
 * 種別ごとの違いはここへ均すときに吸収し、Atom を組む側は種別を知らない。
 */
interface FeedEntry {
  /** ページのパス (ルート相対)。 */
  readonly path: string;
  readonly title: string;
  readonly summary: string;
  /** `YYYY-MM-DD` */
  readonly publishedOn: string;
  /** `YYYY-MM-DD` */
  readonly updatedOn: string;
  /** `<category>` の term。その entry が何であるかの自己記述。 */
  readonly category: string;
}

function articleEntry(article: PublicArticle): FeedEntry {
  return {
    path: articlePath(article.slug),
    title: article.title,
    summary: article.summary,
    publishedOn: article.publishedOn,
    updatedOn: article.lastModifiedOn,
    /*
     * カテゴリは記事ごとに変えず `article` で固定する。タグは廃止した (ADR 0029) が、
     * 「これは記事である」という自己記述は残す。microformats2 の p-category と同じ語で、
     * Post Type Discovery が `p-name` と `e-content` から導く型 (article) とも一致する。
     */
    category: "article",
  };
}

function slideEntry(slide: PublicSlide): FeedEntry {
  return {
    path: slidePath(slide.slug),
    title: slide.title,
    // 語りを書いていないスライドでは空。空の `<summary>` は Atom として妥当。
    summary: slide.summary,
    publishedOn: slide.publishedOn,
    // 直した日は持っていない。記事が `lastModifiedOn` を書かなかったときと同じく、
    // 出した日をそのまま置く。
    updatedOn: slide.publishedOn,
    // All のフィードで記事と混ざるので、何であるかを term で名乗る。
    category: "slide",
  };
}

function entryXml(origin: string, entry: FeedEntry): string {
  const url = `${origin}${entry.path}`;
  /*
   * `<id>` はページの URL そのもの。URL を動かせば id も動き、購読者には 1 回だけ全件が
   * 新着に見える (ADR 0032)。それを飲んで、URL と別の識別子を持たない。
   */
  return `  <entry>
    <title>${escapeXml(entry.title)}</title>
    <link href="${url}"/>
    <id>${url}</id>
    <published>${toRfc3339(entry.publishedOn)}</published>
    <updated>${toRfc3339(entry.updatedOn)}</updated>
    <summary>${escapeXml(entry.summary)}</summary>
    <category term="${escapeXml(entry.category)}"/>
  </entry>`;
}

function buildAtom(
  origin: string,
  entries: readonly FeedEntry[],
  identity: FeedIdentity,
  author: string,
): string {
  // feed 全体の updated は最新の更新日時 (エントリの updatedOn の最大)。
  const updated =
    entries
      .map((entry) => toRfc3339(entry.updatedOn))
      .toSorted((a, b) => a.localeCompare(b))
      .at(-1) ?? FALLBACK_UPDATED;
  const body = entries.map((entry) => entryXml(origin, entry)).join("\n");
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
  <author><name>${escapeXml(author)}</name></author>
${body}
</feed>
`;
}

async function recentArticles(db: D1Database): Promise<readonly FeedEntry[]> {
  const result = await D1ArticleQueryRepository.forReaders(db).list({
    limit: FEED_LIMIT,
    offset: 0,
    sortBy: "publishedOn",
    direction: "desc",
  });
  return result.articles.map((article) => articleEntry(toPublicArticle(article)));
}

/** スライドは全件が出した日の新しい順で返るので、頭から切るだけでよい。 */
async function recentSlides(db: D1Database): Promise<readonly FeedEntry[]> {
  const slides = await D1SlideQueryRepository.forReaders(db).list();
  return slides.slice(0, FEED_LIMIT).map((slide) => slideEntry(toPublicSlide(slide)));
}

/**
 * 種別をまたいで、出した日の新しい順に並べ直して切る。
 *
 * それぞれの種別から {@link FEED_LIMIT} 件ずつ取ってあれば、混ぜた上位 {@link FEED_LIMIT}
 * 件はその中に必ず収まる。同じ日のものはパスの順で決める (並びが要求のたびに揺れると、
 * リーダーによっては順が入れ替わったことを更新として扱う)。
 */
function mergeRecent(...kinds: readonly (readonly FeedEntry[])[]): readonly FeedEntry[] {
  return kinds
    .flat()
    .toSorted((a, b) => {
      const byDate = b.publishedOn.localeCompare(a.publishedOn);
      return byDate === 0 ? a.path.localeCompare(b.path) : byDate;
    })
    .slice(0, FEED_LIMIT);
}

/**
 * その種別の entry を集める。
 *
 * **`notes` はまだ中身が無い** (#412)。コンテンツの型そのものが無いので、空を返す
 * 以外にやりようがない。entry 0 件の Atom は Atom として妥当で、リーダーは
 * 「まだ何も出ていないフィード」として扱う。
 *
 * **種別を網羅する形で書くこと。** 「記事以外は空」と書くと、後から足した種別が黙って
 * 記事の流れを配ることになる — 行き先は feedIdentities から自動で生えるので、足した人が
 * ここに気づかないまま公開される。網羅しておけば型が落ちて気づける (fail-loud)。
 *
 * `all` に混ぜ忘れないこと。種別ごとのフィードだけ増えて全体のフィードに出てこないと、
 * 全部を購読しているつもりの人に届かない。
 */
async function entriesFor(kind: FeedKind, db: D1Database): Promise<readonly FeedEntry[]> {
  switch (kind) {
    case "all": {
      const [articles, slides] = await Promise.all([recentArticles(db), recentSlides(db)]);
      return mergeRecent(articles, slides);
    }
    case "articles":
      return await recentArticles(db);
    case "slides":
      return await recentSlides(db);
    case "notes":
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
      /*
       * 書き手の名前はプロフィールから引く。h-card・記事末尾の筆者紹介・JSON-LD と
       * 同じ 1 つの出どころにしておかないと、`profile.md` で名を改めたときにフィードだけが
       * 古い名前を配り続ける (同じ記事に 2 人の書き手が居ることになる)。
       */
      const [entries, profile] = await Promise.all([
        entriesFor(identity.kind, c.env.D1),
        loadProfile(c.env),
      ]);
      const origin = new URL(c.req.url).origin;
      const author = profile?.displayName ?? FALLBACK_PROFILE_NAME;
      return c.body(buildAtom(origin, entries, identity, author), 200, {
        "Content-Type": "application/atom+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      });
    });
  }

  return router;
}
