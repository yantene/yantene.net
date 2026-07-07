/* eslint-disable no-secrets/no-secrets -- XML/MIME 文字列を秘匿情報と誤検知するため無効化 (秘密は含まない)。 */
import { Hono } from "hono";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

/** sitemap に載せるノート数の上限 (個人ブログ規模では十分)。 */
const SITEMAP_NOTE_LIMIT = 10_000;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function urlEntry(loc: string, lastmod?: string): string {
  const lastmodTag =
    lastmod === undefined ? "" : `<lastmod>${lastmod}</lastmod>`;
  return `  <url><loc>${escapeXml(loc)}</loc>${lastmodTag}</url>`;
}

/**
 * SEO 関連の公開ルータ。認証不要なので index.ts で auth ガードより前にマウントする。
 * - GET /sitemap.xml : ホーム / 一覧 / タグ索引 / 全記事を列挙 (記事は lastmod つき)
 * - GET /robots.txt  : production は sitemap を案内、staging (BASIC 認証あり) は全 Disallow
 */
export function createSeoRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/sitemap.xml", async (c) => {
    const origin = new URL(c.req.url).origin;
    const result = await new D1NoteQueryRepository(c.env.D1).list({
      limit: SITEMAP_NOTE_LIMIT,
      offset: 0,
      sortBy: "lastModifiedOn",
      direction: "desc",
    });

    const staticUrls = [
      urlEntry(`${origin}/`),
      urlEntry(`${origin}/notes`),
      urlEntry(`${origin}/tags`),
    ];
    const noteUrls = result.notes.map((note) =>
      urlEntry(
        `${origin}/notes/${note.slug.toJSON()}`,
        note.lastModifiedOn.toString({ calendarName: "never" }),
      ),
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...noteUrls].join("\n")}
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
      : `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
    return c.body(body, 200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    });
  });

  return router;
}
