// XML/MIME 文字列を秘匿情報と誤検知するため無効化 (秘密は含まない)。
import { Hono } from "hono";
import { articlePath } from "~/backend/domain/article";
import { slidePath } from "~/backend/domain/slide";
import { workPath } from "~/backend/domain/work";
import { loadProfile } from "~/backend/handlers/profile/pages.handler";
import { loadSlides } from "~/backend/handlers/slides/pages.handler";
import { loadWorks } from "~/backend/handlers/works/pages.handler";
import { D1ArticleQueryRepository } from "~/backend/infra/d1/repositories";

/** sitemap に載せる記事数の上限 (個人ブログ規模では十分)。 */
const SITEMAP_ARTICLE_LIMIT = 10_000;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function urlEntry(loc: string, lastmod?: string): string {
  const lastmodTag = lastmod === undefined ? "" : `<lastmod>${lastmod}</lastmod>`;
  return `  <url><loc>${escapeXml(loc)}</loc>${lastmodTag}</url>`;
}

/**
 * SEO 関連の公開ルータ。
 * - GET /sitemap.xml : ホーム / 一覧 / 断り書き / 全記事・全スライド・全作品を列挙
 *   (記事とスライドは lastmod つき)
 * - GET /robots.txt  : production は sitemap を案内、staging (BASIC 認証あり) は全 Disallow
 */
export function createSeoRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/sitemap.xml", async (c) => {
    const origin = new URL(c.req.url).origin;
    const [result, profile, works, slides] = await Promise.all([
      D1ArticleQueryRepository.forReaders(c.env.D1).list({
        limit: SITEMAP_ARTICLE_LIMIT,
        offset: 0,
        sortBy: "lastModifiedOn",
        direction: "desc",
      }),
      loadProfile(c.env),
      loadWorks(c.env),
      loadSlides(c.env),
    ]);

    /*
     * `/about` はプロフィールが同期されていなければ `noindex` を立てる (「準備中」の
     * 一枚になる)。載せたまま `noindex` を出すと、Search Console が「sitemap に出した
     * URL が noindex」と言ってくる。`/works` と `/slides` も 1 件も無ければ同じ姿に
     * なるので同じ扱い。`/notes` を載せていないのも同じ理由。
     */
    const staticUrls = [
      urlEntry(`${origin}/`),
      ...(profile === null ? [] : [urlEntry(`${origin}/about`)]),
      urlEntry(`${origin}/articles`),
      ...(slides.length === 0 ? [] : [urlEntry(`${origin}/slides`)]),
      ...(works.length === 0 ? [] : [urlEntry(`${origin}/works`)]),
      urlEntry(`${origin}/legal`),
    ];
    const articleUrls = result.articles.map((article) =>
      urlEntry(
        `${origin}${articlePath(article.slug.toJSON())}`,
        article.lastModifiedOn.toString({ calendarName: "never" }),
      ),
    );
    // 作品に lastmod は付けない。フロントマターに日付を持たせていないので、出せるのは
    // D1 行の更新時刻だけになる。あれは同期の都合で動く値で、中身が変わった日ではない。
    const workUrls = works.map((work) => urlEntry(`${origin}${workPath(work.slug)}`));
    // スライドの lastmod は出した日。直した日は持っていないので、記事が
    // `lastModifiedOn` を書かなかったときと同じ倒し方にする (出した日 = 最後に変えた日)。
    const slideUrls = slides.map((slide) =>
      urlEntry(`${origin}${slidePath(slide.slug)}`, slide.publishedOn),
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...articleUrls, ...slideUrls, ...workUrls].join("\n")}
</urlset>
`;
    return c.body(xml, 200, {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    });
  });

  router.get("/robots.txt", (c) => {
    const origin = new URL(c.req.url).origin;
    // staging は BASIC 認証が有効 = 非公開環境。存在ベースで確実にクロールを止める
    // (fail-loud / secure by default)。production は BASIC 認証を持たない。
    const isPrivate = Boolean(c.env.BASIC_AUTH_USER);
    const body = isPrivate
      ? "User-agent: *\nDisallow: /\n"
      : // ログインの入口はクロールさせない。中身ではないので検索結果に出す意味が無い。
        // ページ側の `noindex` と対で置く (ADR 0039)。
        `User-agent: *\nAllow: /\nDisallow: /sign-in\n\nSitemap: ${origin}/sitemap.xml\n`;
    return c.body(body, 200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    });
  });

  return router;
}
