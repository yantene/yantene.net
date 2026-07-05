import { describe, expect, it } from "vitest";
import { R2NoteContentCache } from "./r2-note-content-cache";
import { NoteSlug } from "~/backend/domain/note";

interface StoredObject {
  bytes: Uint8Array;
  contentType: string | undefined;
}

/** テスト用の最小 in-memory R2Bucket。get / put / list / delete のみ実装する。 */
function createTestR2(): {
  bucket: R2Bucket;
  store: Map<string, StoredObject>;
} {
  const store = new Map<string, StoredObject>();

  const bucket = {
    put: (
      key: string,
      value: string | ArrayBuffer | ArrayBufferView,
      options?: { httpMetadata?: { contentType?: string } },
    ) => {
      const bytes = toBytes(value);
      store.set(key, {
        bytes,
        contentType: options?.httpMetadata?.contentType,
      });
      return Promise.resolve();
    },
    get: (key: string) => {
      const found = store.get(key);
      if (found === undefined) return Promise.resolve(null);
      return Promise.resolve({
        text: () => Promise.resolve(new TextDecoder().decode(found.bytes)),
        arrayBuffer: () =>
          Promise.resolve(
            found.bytes.buffer.slice(
              found.bytes.byteOffset,
              found.bytes.byteOffset + found.bytes.byteLength,
            ),
          ),
        httpMetadata: { contentType: found.contentType },
      });
    },
    list: (options?: { prefix?: string }) => {
      const prefix = options?.prefix ?? "";
      const objects: { key: string }[] = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) objects.push({ key });
      }
      return Promise.resolve({ objects, truncated: false });
    },
    delete: (keys: string | string[]) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const key of keyList) store.delete(key);
      return Promise.resolve();
    },
  } as unknown as R2Bucket;

  return { bucket, store };
}

function toBytes(value: string | ArrayBuffer | ArrayBufferView): Uint8Array {
  if (typeof value === "string") return new TextEncoder().encode(value);
  return new Uint8Array(value instanceof ArrayBuffer ? value : value.buffer);
}

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
