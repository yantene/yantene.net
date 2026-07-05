import { describe, expect, it } from "vitest";
import { R2NoteContentCache } from "./r2-note-content-cache";
import { createTestR2 } from "./test-helper";
import { NoteSlug } from "~/backend/domain/note";

const slug = NoteSlug.create("my-note");

describe("R2NoteContentCache", () => {
  it("round-trips MDAST as JSON", async () => {
    const { bucket } = createTestR2();
    const cache = new R2NoteContentCache(bucket);

    await cache.putMdast(slug, { type: "root", children: [] });
    expect(await cache.getMdast(slug)).toEqual({ type: "root", children: [] });
  });

  it("returns undefined for a missing MDAST", async () => {
    const cache = new R2NoteContentCache(createTestR2().bucket);
    expect(await cache.getMdast(slug)).toBeUndefined();
  });

  it("round-trips an asset with its content type", async () => {
    const cache = new R2NoteContentCache(createTestR2().bucket);
    const bytes = new Uint8Array([1, 2, 3]);

    await cache.putAsset(slug, "cover.png", {
      bytes,
      contentType: "image/png",
    });
    const asset = await cache.getAsset(slug, "cover.png");

    expect(asset?.bytes).toEqual(bytes);
    expect(asset?.contentType).toBe("image/png");
  });

  it("deletes all cached objects for a note", async () => {
    const { bucket, store } = createTestR2();
    const cache = new R2NoteContentCache(bucket);

    await cache.putMdast(slug, { type: "root" });
    await cache.putAsset(slug, "cover.png", {
      bytes: new Uint8Array([1]),
      contentType: "image/png",
    });
    expect(store.size).toBe(2);

    await cache.deleteNote(slug);
    expect(store.size).toBe(0);
  });
});
