import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1NoteCommandRepository } from "./note.command-repository";
import { D1NoteQueryRepository } from "./note.query-repository";
import type { IUnpersisted } from "~/backend/domain/shared";
import { ImageUrl, Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function unpersistedNote(params: {
  slug: string;
  title: string;
  summary?: string;
  imageUrl?: string;
  publishedOn?: string;
  lastModifiedOn?: string;
}): Note<IUnpersisted> {
  return Note.create({
    slug: NoteSlug.create(params.slug),
    title: NoteTitle.create(params.title),
    summary: params.summary ?? "summary",
    imageUrl:
      params.imageUrl === undefined
        ? undefined
        : ImageUrl.create(params.imageUrl),
    publishedOn: Temporal.PlainDate.from(params.publishedOn ?? "2026-01-15"),
    lastModifiedOn: Temporal.PlainDate.from(
      params.lastModifiedOn ?? "2026-01-20",
    ),
  });
}

describe("D1NoteCommandRepository", () => {
  it("inserts a new note and returns it persisted", async () => {
    const cmd = new D1NoteCommandRepository(createTestD1());

    const saved = await cmd.upsert(
      unpersistedNote({
        slug: "hello",
        title: "Hello",
        imageUrl: "/api/v1/notes/hello/assets/cover.png",
      }),
    );

    expect(saved.id).toBeTruthy();
    expect(saved.slug.toString()).toBe("hello");
    expect(saved.title.toString()).toBe("Hello");
    expect(saved.imageUrl?.toString()).toBe(
      "/api/v1/notes/hello/assets/cover.png",
    );
    expect(saved.createdAt).toBeInstanceOf(Temporal.Instant);
    expect(saved.updatedAt).toBeInstanceOf(Temporal.Instant);
  });

  it("stores a note without a cover image as undefined", async () => {
    const cmd = new D1NoteCommandRepository(createTestD1());
    const saved = await cmd.upsert(unpersistedNote({ slug: "x", title: "X" }));
    expect(saved.imageUrl).toBeUndefined();
  });

  it("updates in place on slug conflict, keeping the same id", async () => {
    const d1 = createTestD1();
    const cmd = new D1NoteCommandRepository(d1);
    const query = new D1NoteQueryRepository(d1);

    const first = await cmd.upsert(
      unpersistedNote({ slug: "post", title: "Original" }),
    );
    const second = await cmd.upsert(
      unpersistedNote({ slug: "post", title: "Updated", summary: "new" }),
    );

    expect(second.id).toBe(first.id);
    expect(second.title.toString()).toBe("Updated");
    expect(second.summary).toBe("new");
    expect(second.createdAt.equals(first.createdAt)).toBe(true);

    const { total } = await query.list({
      limit: 10,
      offset: 0,
      sortBy: "publishedOn",
      direction: "desc",
    });
    expect(total).toBe(1);
  });

  it("deletes a note by slug", async () => {
    const d1 = createTestD1();
    const cmd = new D1NoteCommandRepository(d1);
    const query = new D1NoteQueryRepository(d1);

    await cmd.upsert(unpersistedNote({ slug: "gone", title: "Gone" }));
    await cmd.deleteBySlug(NoteSlug.create("gone"));

    expect(await query.findBySlug(NoteSlug.create("gone"))).toBeUndefined();
  });

  it("deletes a note by id", async () => {
    const d1 = createTestD1();
    const cmd = new D1NoteCommandRepository(d1);
    const query = new D1NoteQueryRepository(d1);

    const saved = await cmd.upsert(
      unpersistedNote({ slug: "byid", title: "T" }),
    );
    await cmd.delete(saved.id);

    expect(await query.findBySlug(NoteSlug.create("byid"))).toBeUndefined();
  });
});
