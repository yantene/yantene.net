import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import type { IUnpersisted } from "~/backend/domain/shared";
import { Note, NoteSlug, NoteTag, NoteTitle } from "~/backend/domain/note";
import { D1NoteCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { createTestApp } from "~/backend/test-app";

function unpersistedNote(params: {
  slug: string;
  title: string;
  summary?: string;
  tags?: readonly string[];
  publishedOn?: string;
  lastModifiedOn?: string;
}): Note<IUnpersisted> {
  return Note.create({
    slug: NoteSlug.create(params.slug),
    title: NoteTitle.create(params.title),
    summary: params.summary ?? "summary",
    imageUrl: undefined,
    tags: (params.tags ?? []).map((tag) => NoteTag.create(tag)),
    publishedOn: Temporal.PlainDate.from(params.publishedOn ?? "2026-01-15"),
    lastModifiedOn: Temporal.PlainDate.from(
      params.lastModifiedOn ?? "2026-01-20",
    ),
    sourceHash: "hash-0",
  });
}

function env(d1: D1Database): Env {
  return { D1: d1 } as unknown as Env;
}

describe("GET /feed.xml", () => {
  it("returns an Atom feed with the correct content type", async () => {
    const d1 = createTestD1();
    const res = await createTestApp().request("/feed.xml", {}, env(d1));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/atom+xml");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    const body = await res.text();
    expect(body).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(body).toContain("<title>やんてね</title>");
  });

  /*
   * id が変わると、リーダーは同じ URL でも別の購読として扱う。サイト全体の
   * フィードの名乗りはタグ別を足した後も動かないこと。
   */
  it("keeps naming the site-wide feed after the site root", async () => {
    const d1 = createTestD1();
    const res = await createTestApp().request(
      "https://example.test/feed.xml",
      {},
      env(d1),
    );
    const body = await res.text();

    expect(body).toContain(
      '<link href="https://example.test/feed.xml" rel="self"',
    );
    expect(body).toContain("<id>https://example.test/</id>");
  });

  it("includes published notes as entries with absolute links", async () => {
    const d1 = createTestD1();
    await new D1NoteCommandRepository(d1).upsert(
      unpersistedNote({ slug: "hello-world", title: "Hello & World" }),
    );

    const res = await createTestApp().request(
      "https://example.test/feed.xml",
      {},
      env(d1),
    );
    const body = await res.text();

    expect(body).toContain("<entry>");
    expect(body).toContain("https://example.test/notes/hello-world");
    // XML エスケープされていること
    expect(body).toContain("Hello &amp; World");
    expect(body).toContain("2026-01-15T00:00:00Z");
  });
});

describe("GET /feed.xml?tag=...", () => {
  async function seedTaggedNotes(d1: D1Database): Promise<void> {
    const command = new D1NoteCommandRepository(d1);
    await command.upsert(
      unpersistedNote({ slug: "tagged", title: "Tagged", tags: ["Web"] }),
    );
    await command.upsert(
      unpersistedNote({ slug: "other", title: "Other", tags: ["日記"] }),
    );
  }

  it("returns only the notes carrying the tag", async () => {
    const d1 = createTestD1();
    await seedTaggedNotes(d1);

    const res = await createTestApp().request(
      "https://example.test/feed.xml?tag=Web",
      {},
      env(d1),
    );
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/atom+xml");
    expect(body).toContain("https://example.test/notes/tagged");
    expect(body).not.toContain("https://example.test/notes/other");
  });

  /* id はリーダーが購読の同一性を決める鍵。全体フィードと衝突させない。 */
  it("names itself after the tag and points self / id at the tag URLs", async () => {
    const d1 = createTestD1();
    await seedTaggedNotes(d1);

    const encoded = encodeURIComponent("日記");
    const res = await createTestApp().request(
      `https://example.test/feed.xml?tag=${encoded}`,
      {},
      env(d1),
    );
    const body = await res.text();

    expect(body).toContain("<title>やんてね — 日記</title>");
    expect(body).toContain(
      `<link href="https://example.test/feed.xml?tag=${encoded}" rel="self"`,
    );
    expect(body).toContain(
      `<id>https://example.test/notes?tag=${encoded}</id>`,
    );
  });

  /* タグ名は XML にも URL にも載る。両方の逃がし方が同時に効くこと。 */
  it("escapes the tag in the feed metadata", async () => {
    const d1 = createTestD1();
    await new D1NoteCommandRepository(d1).upsert(
      unpersistedNote({ slug: "rd", title: "R&D", tags: ["R&D"] }),
    );

    const res = await createTestApp().request(
      `https://example.test/feed.xml?tag=${encodeURIComponent("R&D")}`,
      {},
      env(d1),
    );
    const body = await res.text();

    expect(body).toContain("<title>やんてね — R&amp;D</title>");
    expect(body).toContain("tag=R%26D");
    expect(body).not.toContain("<title>やんてね — R&D</title>");
  });

  /*
   * 該当なしでも 200 + 空フィードを返す。一覧ページと JSON API が同じ条件で
   * 200 + 空を返すのに合わせる。ここだけ 404 にすると、タグを畳んだ日に
   * 購読中のリーダーが一斉に「消えたフィード」として扱ってしまう。
   */
  it("returns an empty feed instead of 404 for a tag no note carries", async () => {
    const d1 = createTestD1();
    await seedTaggedNotes(d1);

    const res = await createTestApp().request(
      "https://example.test/feed.xml?tag=nope",
      {},
      env(d1),
    );
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("<title>やんてね — nope</title>");
    expect(body).not.toContain("<entry>");
  });

  it("falls back to the site-wide feed when the tag is blank", async () => {
    const d1 = createTestD1();
    await seedTaggedNotes(d1);

    const res = await createTestApp().request(
      "https://example.test/feed.xml?tag=%20",
      {},
      env(d1),
    );
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("<title>やんてね</title>");
    expect(body).toContain("https://example.test/notes/other");
  });
});
