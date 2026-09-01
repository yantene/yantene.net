import { Hono } from "hono";
import { toPublicNote, type PublicNote } from "./note-view";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";
import { feedIdentity, type FeedIdentity } from "~/lib/feed";

const FEED_LIMIT = 20;
const FEED_AUTHOR = "yantene";
/** ノートが 1 件も無いときの feed updated (Date に依存させない安全側の既定値)。 */
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

function entryXml(origin: string, note: PublicNote): string {
  const url = `${origin}/notes/${note.slug}`;
  /*
   * カテゴリは記事ごとに変えず `article` で固定する。タグは廃止した (ADR 0029) が、
   * 「これは記事である」という自己記述は残す。microformats2 の p-category と同じ語で、
   * Post Type Discovery が `p-name` と `e-content` から導く型 (article) とも一致する。
   */
  const categories = `    <category term="article"/>`;
  return `  <entry>
    <title>${escapeXml(note.title)}</title>
    <link href="${url}"/>
    <id>${url}</id>
    <published>${toRfc3339(note.publishedOn)}</published>
    <updated>${toRfc3339(note.lastModifiedOn)}</updated>
    <summary>${escapeXml(note.summary)}</summary>
${categories}
  </entry>`;
}

function buildAtom(origin: string, notes: readonly PublicNote[], identity: FeedIdentity): string {
  // feed 全体の updated は最新の更新日時 (エントリの lastModifiedOn の最大)。
  const updated =
    notes
      .map((note) => toRfc3339(note.lastModifiedOn))
      .toSorted((a, b) => a.localeCompare(b))
      .at(-1) ?? FALLBACK_UPDATED;
  const entries = notes.map((note) => entryXml(origin, note)).join("\n");
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

/**
 * Atom フィードの公開ルータ。`GET /feed.xml` が最新ノートを Atom で返す。
 *
 * タグを廃止したのでフィードは 1 本だけ。`?tag=` を付けても無視して全体を返す。
 * 404 にすると、購読中のリーダーが「消えたフィード」として扱ってしまう。
 */
export function createFeedRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/feed.xml", async (c) => {
    const result = await new D1NoteQueryRepository(c.env.D1).list({
      limit: FEED_LIMIT,
      offset: 0,
      sortBy: "publishedOn",
      direction: "desc",
    });

    const origin = new URL(c.req.url).origin;
    const xml = buildAtom(
      origin,
      result.notes.map((note) => toPublicNote(note)),
      feedIdentity(),
    );
    return c.body(xml, 200, {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    });
  });

  return router;
}
