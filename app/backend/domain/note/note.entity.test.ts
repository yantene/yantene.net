import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { ETag } from "../shared/etag.vo";
import { ImageUrl } from "./image-url.vo";
import { NoteSlug } from "./note-slug.vo";
import { NoteTitle } from "./note-title.vo";
import { Note } from "./note.entity";

describe("Note Entity", () => {
  const validPublishedOn = Temporal.PlainDate.from("2026-02-17");
  const validLastModifiedOn = Temporal.PlainDate.from("2026-02-18");

  const validParams = {
    title: NoteTitle.create("My First Post"),
    slug: NoteSlug.create("my-first-post"),
    etag: ETag.create('"abc123"'),
    imageUrl: ImageUrl.create("https://example.com/image.png"),
    publishedOn: validPublishedOn,
    lastModifiedOn: validLastModifiedOn,
  };

  describe("create()", () => {
    it("should create an unpersisted entity with valid params", () => {
      const note = Note.create(validParams);

      expect(note.id).toBeUndefined();
      expect(note.title.value).toBe("My First Post");
      expect(note.slug.value).toBe("my-first-post");
      expect(note.etag.value).toBe('"abc123"');
      expect(note.imageUrl.value).toBe("https://example.com/image.png");
      expect(note.publishedOn.toString()).toBe("2026-02-17");
      expect(note.lastModifiedOn.toString()).toBe("2026-02-18");
      expect(note.createdAt).toBeUndefined();
      expect(note.updatedAt).toBeUndefined();
    });
  });

  describe("reconstruct()", () => {
    it("should reconstruct a persisted entity from database data", () => {
      const id = "test-uuid";
      const createdAt = Temporal.Now.instant();
      const updatedAt = Temporal.Now.instant();

      const note = Note.reconstruct({
        id,
        ...validParams,
        createdAt,
        updatedAt,
      });

      expect(note.id).toBe(id);
      expect(note.title.value).toBe("My First Post");
      expect(note.slug.value).toBe("my-first-post");
      expect(note.etag.value).toBe('"abc123"');
      expect(note.imageUrl.value).toBe("https://example.com/image.png");
      expect(note.publishedOn.toString()).toBe("2026-02-17");
      expect(note.lastModifiedOn.toString()).toBe("2026-02-18");
      expect(note.createdAt).toBe(createdAt);
      expect(note.updatedAt).toBe(updatedAt);
    });
  });

  describe("equals()", () => {
    it("should return true for persisted entities with the same id", () => {
      const id = "test-uuid";
      const instant = Temporal.Now.instant();

      const note1 = Note.reconstruct({
        id,
        ...validParams,
        createdAt: instant,
        updatedAt: instant,
      });
      const note2 = Note.reconstruct({
        id,
        title: NoteTitle.create("Different Title"),
        slug: NoteSlug.create("different-slug"),
        etag: ETag.create('"def456"'),
        imageUrl: ImageUrl.create("https://example.com/other.png"),
        publishedOn: Temporal.PlainDate.from("2025-01-01"),
        lastModifiedOn: Temporal.PlainDate.from("2025-06-15"),
        createdAt: instant,
        updatedAt: instant,
      });

      expect(note1.equals(note2)).toBe(true);
    });

    it("should return false for persisted entities with different ids", () => {
      const instant = Temporal.Now.instant();

      const note1 = Note.reconstruct({
        id: "uuid-1",
        ...validParams,
        createdAt: instant,
        updatedAt: instant,
      });
      const note2 = Note.reconstruct({
        id: "uuid-2",
        ...validParams,
        createdAt: instant,
        updatedAt: instant,
      });

      expect(note1.equals(note2)).toBe(false);
    });

    it("should return false for different unpersisted entities", () => {
      const note1 = Note.create(validParams);
      const note2 = Note.create(validParams);

      expect(note1.equals(note2)).toBe(false);
    });

    it("should return true for the same unpersisted entity reference", () => {
      const note = Note.create(validParams);

      expect(note.equals(note)).toBe(true);
    });
  });

  describe("toJSON()", () => {
    it("should convert persisted entity to plain object", () => {
      const id = "test-uuid";
      const createdAt = Temporal.Now.instant();
      const updatedAt = Temporal.Now.instant();

      const note = Note.reconstruct({
        id,
        ...validParams,
        createdAt,
        updatedAt,
      });

      const json = note.toJSON();

      expect(json.id).toBe(id);
      expect(json.title).toBe("My First Post");
      expect(json.slug).toBe("my-first-post");
      expect(json.etag).toBe('"abc123"');
      expect(json.imageUrl).toBe("https://example.com/image.png");
      expect(json.publishedOn).toBe("2026-02-17");
      expect(json.lastModifiedOn).toBe("2026-02-18");
      expect(json.createdAt).toBe(createdAt.toString());
      expect(json.updatedAt).toBe(updatedAt.toString());
    });

    it("should handle undefined fields in unpersisted entity", () => {
      const note = Note.create(validParams);

      const json = note.toJSON();

      expect(json.id).toBeUndefined();
      expect(json.title).toBe("My First Post");
      expect(json.slug).toBe("my-first-post");
      expect(json.etag).toBe('"abc123"');
      expect(json.imageUrl).toBe("https://example.com/image.png");
      expect(json.publishedOn).toBe("2026-02-17");
      expect(json.lastModifiedOn).toBe("2026-02-18");
      expect(json.createdAt).toBeUndefined();
      expect(json.updatedAt).toBeUndefined();
    });
  });

  describe("readonly properties", () => {
    it("should expose all properties as readonly", () => {
      const note = Note.create(validParams);

      // TypeScript enforces readonly at compile-time.
      // At runtime, we verify that the properties exist and match the expected values.
      expect(note.title).toBe(validParams.title);
      expect(note.slug).toBe(validParams.slug);
      expect(note.etag).toBe(validParams.etag);
      expect(note.imageUrl).toBe(validParams.imageUrl);
    });
  });
});
