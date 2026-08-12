import { describe, expect, it } from "vitest";
import { R2LinkCardAssetCache } from "./r2-link-card-asset-cache";
import { createTestR2 } from "./test-helper";

const asset = {
  bytes: new Uint8Array([1, 2, 3]),
  contentType: "image/png",
};

describe("R2LinkCardAssetCache", () => {
  it("カードごとのプレフィックスに置く", async () => {
    const { bucket, store } = createTestR2();
    const cache = new R2LinkCardAssetCache(bucket);

    await cache.putImage("abc", asset);
    await cache.putFavicon("abc", asset);

    expect(store.size).toBe(2);
    expect(store.has("link-cards/abc/image")).toBe(true);
    expect(store.has("link-cards/abc/favicon")).toBe(true);
  });

  it("置いたものを Content-Type ごと読み戻せる", async () => {
    const { bucket } = createTestR2();
    const cache = new R2LinkCardAssetCache(bucket);

    await cache.putImage("abc", asset);

    const found = await cache.getImage("abc");
    expect(found?.contentType).toBe("image/png");
    expect([...(found?.bytes ?? [])]).toEqual([1, 2, 3]);
  });

  it("無いものは undefined", async () => {
    const { bucket } = createTestR2();
    const cache = new R2LinkCardAssetCache(bucket);

    await expect(cache.getImage("missing")).resolves.toBeUndefined();
    await expect(cache.getFavicon("missing")).resolves.toBeUndefined();
  });

  it("そのカードの画像だけをまとめて捨てる", async () => {
    const { bucket, store } = createTestR2();
    const cache = new R2LinkCardAssetCache(bucket);

    await cache.putImage("abc", asset);
    await cache.putFavicon("abc", asset);
    await cache.putImage("other", asset);

    await cache.deleteAssets("abc");

    expect(store.size).toBe(1);
    expect(store.has("link-cards/other/image")).toBe(true);
  });
});
