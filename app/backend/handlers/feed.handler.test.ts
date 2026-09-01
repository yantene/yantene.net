import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import type { IUnpersisted } from "~/backend/domain/shared";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import { D1NoteCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { createTestApp } from "~/backend/test-app";

function unpersistedNote(params: {
  slug: string;
  title: string;
  summary?: string;
  publishedOn?: string;
  lastModifiedOn?: string;
}): Note<IUnpersisted> {
  return Note.create({
    slug: NoteSlug.create(params.slug),
    title: NoteTitle.create(params.title),
    summary: params.summary ?? "summary",
    imageUrl: undefined,
    publishedOn: Temporal.PlainDate.from(params.publishedOn ?? "2026-01-15"),
    lastModifiedOn: Temporal.PlainDate.from(params.lastModifiedOn ?? "2026-01-20"),
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
    const res = await createTestApp().request("https://example.test/feed.xml", {}, env(d1));
    const body = await res.text();

    expect(body).toContain('<link href="https://example.test/feed.xml" rel="self"');
    expect(body).toContain("<id>https://example.test/</id>");
  });

  it("includes published notes as entries with absolute links", async () => {
    const d1 = createTestD1();
    await new D1NoteCommandRepository(d1).upsert(
      unpersistedNote({ slug: "hello-world", title: "Hello & World" }),
    );

    const res = await createTestApp().request("https://example.test/feed.xml", {}, env(d1));
    const body = await res.text();

    expect(body).toContain("<entry>");
    expect(body).toContain("https://example.test/notes/hello-world");
    // XML エスケープされていること
    expect(body).toContain("Hello &amp; World");
    expect(body).toContain("2026-01-15T00:00:00Z");
  });
});

/*
 * タグは廃止したが、カテゴリは `article` で固定して残す。microformats2 の p-category と
 * 同じ語で、Post Type Discovery が導く型とも一致する。
 */
describe("カテゴリ", () => {
  it("どの記事にも article のカテゴリが付く", async () => {
    const d1 = createTestD1();
    await new D1NoteCommandRepository(d1).upsert(unpersistedNote({ slug: "a", title: "A" }));

    const res = await createTestApp().request("https://example.test/feed.xml", {}, env(d1));
    const body = await res.text();

    expect(body).toContain('<category term="article"/>');
  });

  it("?tag= を付けても無視して全体を返す", async () => {
    const d1 = createTestD1();
    const command = new D1NoteCommandRepository(d1);
    await command.upsert(unpersistedNote({ slug: "a", title: "A" }));
    await command.upsert(unpersistedNote({ slug: "b", title: "B" }));

    const res = await createTestApp().request("https://example.test/feed.xml?tag=Web", {}, env(d1));
    const body = await res.text();

    // 404 にすると、購読中のリーダーが「消えたフィード」として扱ってしまう。
    expect(res.status).toBe(200);
    expect(body).toContain("https://example.test/notes/a");
    expect(body).toContain("https://example.test/notes/b");
    expect(body).toContain("<title>やんてね</title>");
  });
});
