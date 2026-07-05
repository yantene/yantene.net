import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1NoteCommandRepository } from "./note.command-repository";
import { D1NoteQueryRepository } from "./note.query-repository";
import type { IUnpersisted } from "~/backend/domain/shared";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function seed(params: {
  slug: string;
  publishedOn: string;
  lastModifiedOn?: string;
}): Note<IUnpersisted> {
  return Note.create({
    slug: NoteSlug.create(params.slug),
    title: NoteTitle.create(params.slug),
    summary: "s",
    publishedOn: Temporal.PlainDate.from(params.publishedOn),
    lastModifiedOn: Temporal.PlainDate.from(
      params.lastModifiedOn ?? params.publishedOn,
    ),
  });
}

async function seedNotes(cmd: D1NoteCommandRepository): Promise<void> {
  await cmd.upsert(seed({ slug: "a", publishedOn: "2026-01-10" }));
  await cmd.upsert(seed({ slug: "b", publishedOn: "2026-03-10" }));
  await cmd.upsert(seed({ slug: "c", publishedOn: "2026-02-10" }));
}

describe("D1NoteQueryRepository", () => {
  it("returns undefined for an unknown slug", async () => {
    const query = new D1NoteQueryRepository(createTestD1());
    expect(await query.findBySlug(NoteSlug.create("nope"))).toBeUndefined();
  });

  it("finds a note by slug after upsert", async () => {
    const d1 = createTestD1();
    await new D1NoteCommandRepository(d1).upsert(
      seed({ slug: "found", publishedOn: "2026-01-01" }),
    );
    const found = await new D1NoteQueryRepository(d1).findBySlug(
      NoteSlug.create("found"),
    );
    expect(found?.slug.toString()).toBe("found");
  });

  it("orders by publishedOn descending by default sort field", async () => {
    const d1 = createTestD1();
    await seedNotes(new D1NoteCommandRepository(d1));

    const { notes, total } = await new D1NoteQueryRepository(d1).list({
      limit: 10,
      offset: 0,
      sortBy: "publishedOn",
      direction: "desc",
    });

    expect(total).toBe(3);
    expect(notes.map((n) => n.slug.toString())).toEqual(["b", "c", "a"]);
  });

  it("orders ascending when requested", async () => {
    const d1 = createTestD1();
    await seedNotes(new D1NoteCommandRepository(d1));

    const { notes } = await new D1NoteQueryRepository(d1).list({
      limit: 10,
      offset: 0,
      sortBy: "publishedOn",
      direction: "asc",
    });

    expect(notes.map((n) => n.slug.toString())).toEqual(["a", "c", "b"]);
  });

  it("applies limit and offset for pagination while total stays the full count", async () => {
    const d1 = createTestD1();
    await seedNotes(new D1NoteCommandRepository(d1));

    const { notes, total } = await new D1NoteQueryRepository(d1).list({
      limit: 1,
      offset: 1,
      sortBy: "publishedOn",
      direction: "desc",
    });

    expect(total).toBe(3);
    expect(notes.map((n) => n.slug.toString())).toEqual(["c"]);
  });
});
