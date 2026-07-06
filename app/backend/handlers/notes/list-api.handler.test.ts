import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { createNotesApiRouter } from "./list-api.handler";
import type { IUnpersisted } from "~/backend/domain/shared";
import type { PublicNoteList } from "~/backend/handlers/note-view";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import { D1NoteCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function note(slug: string, publishedOn: string): Note<IUnpersisted> {
  return Note.create({
    slug: NoteSlug.create(slug),
    title: NoteTitle.create(slug),
    summary: `summary of ${slug}`,
    publishedOn: Temporal.PlainDate.from(publishedOn),
    lastModifiedOn: Temporal.PlainDate.from(publishedOn),
    sourceHash: `hash-${slug}`,
  });
}

async function seed(d1: D1Database): Promise<void> {
  const cmd = new D1NoteCommandRepository(d1);
  await cmd.upsert(note("a", "2026-01-10"));
  await cmd.upsert(note("b", "2026-03-10"));
  await cmd.upsert(note("c", "2026-02-10"));
}

function envWith(d1: D1Database): Env {
  return { D1: d1 } as unknown as Env;
}

/**
 * GET / を叩いてボディを PublicNoteList として取り出す。Hono の request() 応答型は
 * ここでは解決できないため、text() → JSON.parse で明示的に読み取る。
 */
async function fetchList(d1: D1Database, query = ""): Promise<PublicNoteList> {
  const res = await createNotesApiRouter().request(
    `/${query}`,
    {},
    envWith(d1),
  );
  expect(res.status).toBe(200);
  const text = await res.text();
  return JSON.parse(text) as PublicNoteList;
}

describe("createNotesApiRouter GET /", () => {
  it("returns notes without requiring a session (public)", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const body = await fetchList(d1);
    expect(body.pagination).toEqual({
      page: 1,
      perPage: 20,
      total: 3,
      totalPages: 1,
    });
    // 既定は publishedOn 降順。
    expect(body.notes.map((n) => n.slug)).toEqual(["b", "c", "a"]);
  });

  it("paginates with page and per-page", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const body = await fetchList(d1, "?page=2&per-page=2");
    expect(body.pagination).toEqual({
      page: 2,
      perPage: 2,
      total: 3,
      totalPages: 2,
    });
    expect(body.notes.map((n) => n.slug)).toEqual(["a"]);
  });

  it("clamps an out-of-range page to totalPages", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const body = await fetchList(d1, "?page=9999&per-page=2");
    // 3 件 / per-page 2 → 2 ページ。9999 は 2 に丸められる。
    expect(body.pagination.totalPages).toBe(2);
    expect(body.pagination.page).toBe(2);
  });

  it("sorts ascending when order=asc", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const body = await fetchList(d1, "?sort-by=published&order=asc");
    expect(body.notes.map((n) => n.slug)).toEqual(["a", "c", "b"]);
  });

  it("exposes only public fields and null imageUrl when absent", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const body = await fetchList(d1);
    const first = body.notes[0];

    expect(Object.keys(first).toSorted((a, b) => a.localeCompare(b))).toEqual([
      "imageUrl",
      "lastModifiedOn",
      "publishedOn",
      "slug",
      "summary",
      "tags",
      "title",
    ]);
    expect(first.imageUrl).toBeNull();
    expect(first.publishedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
