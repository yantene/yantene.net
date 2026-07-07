import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import type { IUnpersisted } from "~/backend/domain/shared";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import app from "~/backend/index";
import { D1NoteCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

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
    lastModifiedOn: Temporal.PlainDate.from(
      params.lastModifiedOn ?? "2026-01-20",
    ),
    sourceHash: "hash-0",
  });
}

function env(d1: D1Database): Env {
  return { D1: d1, KV: {} } as unknown as Env;
}

describe("GET /feed.xml", () => {
  it("returns an Atom feed with the correct content type", async () => {
    const d1 = createTestD1();
    const res = await app.request("/feed.xml", {}, env(d1));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/atom+xml");
    const body = await res.text();
    expect(body).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(body).toContain("<title>yantene.net</title>");
  });

  it("includes published notes as entries with absolute links", async () => {
    const d1 = createTestD1();
    await new D1NoteCommandRepository(d1).upsert(
      unpersistedNote({ slug: "hello-world", title: "Hello & World" }),
    );

    const res = await app.request("https://example.test/feed.xml", {}, env(d1));
    const body = await res.text();

    expect(body).toContain("<entry>");
    expect(body).toContain("https://example.test/notes/hello-world");
    // XML エスケープされていること
    expect(body).toContain("Hello &amp; World");
    expect(body).toContain("2026-01-15T00:00:00Z");
  });
});
