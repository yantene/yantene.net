import { describe, expect, it } from "vitest";
import { R2NoteContentCache } from "./r2-note-content-cache";
import { createTestR2 } from "./test-helper";
import { NoteSlug } from "~/backend/domain/note";

const slug = NoteSlug.create("my-note");

describe("R2NoteContentCache", () => {
  it("round-trips the source markdown with a markdown content type", async () => {
    const { bucket, store } = createTestR2();
    const cache = new R2NoteContentCache(bucket);
    const markdown = "---\ntitle: Hi\n---\n\nBody ![a](./x.png).\n";

    await cache.putSource(slug, markdown);

    expect(await cache.getSource(slug)).toBe(markdown);
    expect(store.get("notes/my-note/source.md")?.contentType).toBe(
      "text/markdown; charset=utf-8",
    );
  });

  it("returns undefined for a missing source", async () => {
    const cache = new R2NoteContentCache(createTestR2().bucket);
    expect(await cache.getSource(slug)).toBeUndefined();
  });

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

    await cache.putSource(slug, "# Hi\n");
    await cache.putMdast(slug, { type: "root" });
    await cache.putAsset(slug, "cover.png", {
      bytes: new Uint8Array([1]),
      contentType: "image/png",
    });
    expect(store.size).toBe(3);

    await cache.deleteNote(slug);
    expect(store.size).toBe(0);
  });
});
