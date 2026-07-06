import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1NoteCommandRepository } from "./note.command-repository";
import { D1NoteQueryRepository } from "./note.query-repository";
import type { IUnpersisted } from "~/backend/domain/shared";
import { Note, NoteSlug, NoteTag, NoteTitle } from "~/backend/domain/note";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function seedTagged(
  slug: string,
  publishedOn: string,
  tags: readonly string[],
): Note<IUnpersisted> {
  return Note.create({
    slug: NoteSlug.create(slug),
    title: NoteTitle.create(slug),
    summary: "s",
    tags: tags.map((tag) => NoteTag.create(tag)),
    publishedOn: Temporal.PlainDate.from(publishedOn),
    lastModifiedOn: Temporal.PlainDate.from(publishedOn),
    sourceHash: `hash-${slug}`,
  });
}

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
    sourceHash: `hash-${params.slug}`,
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

  it("returns slug -> sourceHash map for change detection", async () => {
    const d1 = createTestD1();
    await seedNotes(new D1NoteCommandRepository(d1));

    const hashes = await new D1NoteQueryRepository(d1).listSourceHashes();
    expect(hashes.get("a")).toBe("hash-a");
    expect(hashes.get("b")).toBe("hash-b");
    expect(hashes.size).toBe(3);
  });

  it("keeps a stable order across pages when dates tie (slug tiebreaker)", async () => {
    const d1 = createTestD1();
    const cmd = new D1NoteCommandRepository(d1);
    // 全て同じ publishedOn。タイブレーカが無いと offset ページングで重複・欠落しうる。
    await cmd.upsert(seed({ slug: "c", publishedOn: "2026-01-15" }));
    await cmd.upsert(seed({ slug: "a", publishedOn: "2026-01-15" }));
    await cmd.upsert(seed({ slug: "b", publishedOn: "2026-01-15" }));
    const query = new D1NoteQueryRepository(d1);

    const page1 = await query.list({
      limit: 2,
      offset: 0,
      sortBy: "publishedOn",
      direction: "desc",
    });
    const page2 = await query.list({
      limit: 2,
      offset: 2,
      sortBy: "publishedOn",
      direction: "desc",
    });

    // slug 昇順で安定 → ページをまたいで a, b, c が重複なく並ぶ。
    expect(page1.notes.map((n) => n.slug.toString())).toEqual(["a", "b"]);
    expect(page2.notes.map((n) => n.slug.toString())).toEqual(["c"]);
  });

  it("loads a note's tags on findBySlug", async () => {
    const d1 = createTestD1();
    await new D1NoteCommandRepository(d1).upsert(
      seedTagged("t", "2026-01-01", ["日記", "プログラミング"]),
    );
    const found = await new D1NoteQueryRepository(d1).findBySlug(
      NoteSlug.create("t"),
    );
    expect(
      found?.tags
        .map((tag) => tag.toString())
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(["プログラミング", "日記"]);
  });

  it("filters the list by tag (total = filtered count)", async () => {
    const d1 = createTestD1();
    const cmd = new D1NoteCommandRepository(d1);
    await cmd.upsert(seedTagged("a", "2026-01-01", ["日記"]));
    await cmd.upsert(seedTagged("b", "2026-02-01", ["日記", "試験"]));
    await cmd.upsert(seedTagged("c", "2026-03-01", ["試験"]));

    const { notes, total } = await new D1NoteQueryRepository(d1).list({
      limit: 10,
      offset: 0,
      sortBy: "publishedOn",
      direction: "desc",
      tag: "日記",
    });

    expect(total).toBe(2);
    expect(notes.map((n) => n.slug.toString())).toEqual(["b", "a"]);
  });

  it("lists tags with counts (count desc)", async () => {
    const d1 = createTestD1();
    const cmd = new D1NoteCommandRepository(d1);
    await cmd.upsert(seedTagged("a", "2026-01-01", ["日記"]));
    await cmd.upsert(seedTagged("b", "2026-02-01", ["日記", "試験"]));

    const tags = await new D1NoteQueryRepository(d1).listTags();
    expect(tags).toEqual([
      { tag: "日記", count: 2 },
      { tag: "試験", count: 1 },
    ]);
  });

  it("replaces tags on re-upsert (no stale tags)", async () => {
    const d1 = createTestD1();
    const cmd = new D1NoteCommandRepository(d1);
    await cmd.upsert(seedTagged("x", "2026-01-01", ["古い"]));
    await cmd.upsert(seedTagged("x", "2026-01-01", ["新しい"]));

    const found = await new D1NoteQueryRepository(d1).findBySlug(
      NoteSlug.create("x"),
    );
    expect(found?.tags.map((tag) => tag.toString())).toEqual(["新しい"]);
  });
});
