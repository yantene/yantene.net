import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { ImageUrl } from "./image-url.vo";
import { NoteSlug } from "./note-slug.vo";
import { NoteTitle } from "./note-title.vo";
import { Note } from "./note.entity";
import { entityId } from "~/backend/domain/shared";

const slug = NoteSlug.create("my-note");
const title = NoteTitle.create("My Note");
const publishedOn = Temporal.PlainDate.from("2026-01-15");
const lastModifiedOn = Temporal.PlainDate.from("2026-01-20");

describe("Note.create", () => {
  it("builds an unpersisted note with undefined id and timestamps", () => {
    const note = Note.create({
      slug,
      title,
      summary: "A short summary.",
      publishedOn,
      lastModifiedOn,
    });

    expect(note.id).toBeUndefined();
    expect(note.createdAt).toBeUndefined();
    expect(note.updatedAt).toBeUndefined();
    expect(note.slug.toString()).toBe("my-note");
    expect(note.title.toString()).toBe("My Note");
    expect(note.summary).toBe("A short summary.");
    expect(note.imageUrl).toBeUndefined();
    expect(note.publishedOn.toString()).toBe("2026-01-15");
    expect(note.lastModifiedOn.toString()).toBe("2026-01-20");
  });

  it("retains an optional cover image", () => {
    const note = Note.create({
      slug,
      title,
      summary: "s",
      imageUrl: ImageUrl.create("/api/v1/notes/my-note/assets/cover.png"),
      publishedOn,
      lastModifiedOn,
    });

    expect(note.imageUrl?.toString()).toBe(
      "/api/v1/notes/my-note/assets/cover.png",
    );
  });
});

describe("Note.reconstruct", () => {
  it("restores a persisted note with id and timestamps", () => {
    const createdAt = Temporal.Instant.from("2026-01-15T00:00:00Z");
    const updatedAt = Temporal.Instant.from("2026-01-20T00:00:00Z");
    const note = Note.reconstruct({
      id: entityId<"Note">("note-1"),
      slug,
      title,
      summary: "s",
      imageUrl: undefined,
      publishedOn,
      lastModifiedOn,
      createdAt,
      updatedAt,
    });

    expect(note.id).toBe("note-1");
    expect(note.createdAt.equals(createdAt)).toBe(true);
    expect(note.updatedAt.equals(updatedAt)).toBe(true);
  });
});
