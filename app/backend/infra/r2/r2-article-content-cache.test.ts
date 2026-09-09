import { describe, expect, it } from "vitest";
import { R2ArticleContentCache } from "./r2-article-content-cache";
import { createTestR2 } from "./test-helper";
import { ArticleSlug } from "~/backend/domain/article";

const slug = ArticleSlug.create("my-article");

describe("R2ArticleContentCache", () => {
  it("round-trips the source markdown with a markdown content type", async () => {
    const { bucket, store } = createTestR2();
    const cache = new R2ArticleContentCache(bucket);
    const markdown = "---\ntitle: Hi\n---\n\nBody ![a](./x.png).\n";

    await cache.putSource(slug, markdown);

    expect(await cache.getSource(slug)).toBe(markdown);
    expect(store.get("articles/my-article/source.md")?.contentType).toBe(
      "text/markdown; charset=utf-8",
    );
  });

  it("returns undefined for a missing source", async () => {
    const cache = new R2ArticleContentCache(createTestR2().bucket);
    expect(await cache.getSource(slug)).toBeUndefined();
  });

  it("round-trips MDAST as JSON", async () => {
    const { bucket } = createTestR2();
    const cache = new R2ArticleContentCache(bucket);

    await cache.putMdast(slug, { type: "root", children: [] });
    expect(await cache.getMdast(slug)).toEqual({ type: "root", children: [] });
  });

  it("returns undefined for a missing MDAST", async () => {
    const cache = new R2ArticleContentCache(createTestR2().bucket);
    expect(await cache.getMdast(slug)).toBeUndefined();
  });

  it("round-trips an asset with its content type", async () => {
    const cache = new R2ArticleContentCache(createTestR2().bucket);
    const bytes = new Uint8Array([1, 2, 3]);

    await cache.putAsset(slug, "cover.png", {
      bytes,
      contentType: "image/png",
    });
    const asset = await cache.getAsset(slug, "cover.png");

    expect(asset?.bytes).toEqual(bytes);
    expect(asset?.contentType).toBe("image/png");
  });

  /*
   * リネーム・削除で行き場を失った写しだけを片付ける。**原文と MDAST は消さない。**
   * 消してから書き直す形だと、途中で落ちたときに記事が消えたまま残る (#310)。
   */
  it("prunes only the assets that are no longer listed", async () => {
    const { bucket, store } = createTestR2();
    const cache = new R2ArticleContentCache(bucket);

    await cache.putSource(slug, "# Hi\n");
    await cache.putMdast(slug, { type: "root" });
    for (const path of ["cover.png", "img/a.png", "old.png"]) {
      await cache.putAsset(slug, path, {
        bytes: new Uint8Array([1]),
        contentType: "image/png",
      });
    }
    expect(store.size).toBe(5);

    await cache.pruneAssets(slug, new Set(["cover.png", "img/a.png"]));

    expect(await cache.getAsset(slug, "old.png")).toBeUndefined();
    expect(await cache.getAsset(slug, "cover.png")).toBeDefined();
    // 入れ子のパスも残す (前置を落として突き合わせる)。
    expect(await cache.getAsset(slug, "img/a.png")).toBeDefined();
    // 原文と MDAST には触らない。
    expect(await cache.getSource(slug)).toBe("# Hi\n");
    expect(await cache.getMdast(slug)).toEqual({ type: "root" });
  });

  it("prunes every asset when none are listed", async () => {
    const { bucket } = createTestR2();
    const cache = new R2ArticleContentCache(bucket);

    await cache.putSource(slug, "# Hi\n");
    await cache.putAsset(slug, "cover.png", {
      bytes: new Uint8Array([1]),
      contentType: "image/png",
    });

    await cache.pruneAssets(slug, new Set());

    expect(await cache.getAsset(slug, "cover.png")).toBeUndefined();
    expect(await cache.getSource(slug)).toBe("# Hi\n");
  });

  /*
   * 本物の R2 は 1 回で全部返さない。**残したものは次の頁でも列挙されない**ので、
   * cursor を辿らない実装だと 2 頁目以降が片付かず、位置ではなく件数で辿る実装だと
   * 残したぶんだけ位置がずれて取りこぼす。1 頁 2 件にして確かめる。
   */
  it("prunes across pages", async () => {
    const { bucket } = createTestR2(2);
    const cache = new R2ArticleContentCache(bucket);

    const paths = ["a.png", "b.png", "c.png", "d.png", "e.png"];
    for (const path of paths) {
      await cache.putAsset(slug, path, {
        bytes: new Uint8Array([1]),
        contentType: "image/png",
      });
    }

    await cache.pruneAssets(slug, new Set(["b.png", "d.png"]));

    expect(await cache.getAsset(slug, "b.png")).toBeDefined();
    expect(await cache.getAsset(slug, "d.png")).toBeDefined();
    for (const gone of ["a.png", "c.png", "e.png"]) {
      expect(await cache.getAsset(slug, gone)).toBeUndefined();
    }
  });

  it("deletes across pages", async () => {
    const { bucket, store } = createTestR2(2);
    const cache = new R2ArticleContentCache(bucket);

    for (const path of ["a.png", "b.png", "c.png", "d.png", "e.png"]) {
      await cache.putAsset(slug, path, {
        bytes: new Uint8Array([1]),
        contentType: "image/png",
      });
    }

    await cache.deleteArticle(slug);

    expect(store.size).toBe(0);
  });

  it("deletes all cached objects for an article", async () => {
    const { bucket, store } = createTestR2();
    const cache = new R2ArticleContentCache(bucket);

    await cache.putSource(slug, "# Hi\n");
    await cache.putMdast(slug, { type: "root" });
    await cache.putAsset(slug, "cover.png", {
      bytes: new Uint8Array([1]),
      contentType: "image/png",
    });
    expect(store.size).toBe(3);

    await cache.deleteArticle(slug);
    expect(store.size).toBe(0);
  });
});

/*
 * 改名前の接頭辞 `notes/<slug>/` からの移行 (ADR 0032)。次のリリースで消す。
 */
describe("R2ArticleContentCache with copies under the former prefix", () => {
  function putFormer(
    store: Map<string, { bytes: Uint8Array; contentType: string | undefined }>,
  ): void {
    const encoder = new TextEncoder();
    store.set("notes/my-article/source.md", {
      bytes: encoder.encode("# Former\n"),
      contentType: "text/markdown; charset=utf-8",
    });
    store.set("notes/my-article/mdast.json", {
      bytes: encoder.encode('{"type":"root","former":true}'),
      contentType: "application/json",
    });
    store.set("notes/my-article/assets/cover.png", {
      bytes: new Uint8Array([9]),
      contentType: "image/png",
    });
  }

  it("reads the former copies when the new ones are missing", async () => {
    const { bucket, store } = createTestR2();
    putFormer(store);
    const cache = new R2ArticleContentCache(bucket);

    expect(await cache.getSource(slug)).toBe("# Former\n");
    expect(await cache.getMdast(slug)).toEqual({ type: "root", former: true });
    expect((await cache.getAsset(slug, "cover.png"))?.bytes).toEqual(new Uint8Array([9]));
  });

  /* 写し直した記事が古い写しを出してはいけない。 */
  it("prefers the new copies over the former ones", async () => {
    const { bucket, store } = createTestR2();
    putFormer(store);
    const cache = new R2ArticleContentCache(bucket);

    await cache.putSource(slug, "# New\n");
    await cache.putMdast(slug, { type: "root" });
    await cache.putAsset(slug, "cover.png", {
      bytes: new Uint8Array([1]),
      contentType: "image/png",
    });

    expect(await cache.getSource(slug)).toBe("# New\n");
    expect(await cache.getMdast(slug)).toEqual({ type: "root" });
    expect((await cache.getAsset(slug, "cover.png"))?.bytes).toEqual(new Uint8Array([1]));
  });

  it("writes only under the new prefix", async () => {
    const { bucket, store } = createTestR2();
    const cache = new R2ArticleContentCache(bucket);

    await cache.putSource(slug, "# New\n");
    await cache.putMdast(slug, { type: "root" });
    await cache.putAsset(slug, "cover.png", {
      bytes: new Uint8Array([1]),
      contentType: "image/png",
    });

    expect([...store.keys()].toSorted()).toEqual([
      "articles/my-article/assets/cover.png",
      "articles/my-article/mdast.json",
      "articles/my-article/source.md",
    ]);
  });

  /*
   * refresh は書き終えてから片付けに来る。そのときに古い写しを丸ごと消せば、force refresh を
   * 1 回流すだけで旧接頭辞の下が空になる。
   */
  it("drops every former copy when pruning", async () => {
    const { bucket, store } = createTestR2();
    putFormer(store);
    const cache = new R2ArticleContentCache(bucket);
    await cache.putSource(slug, "# New\n");
    await cache.putMdast(slug, { type: "root" });
    await cache.putAsset(slug, "cover.png", {
      bytes: new Uint8Array([1]),
      contentType: "image/png",
    });

    await cache.pruneAssets(slug, new Set(["cover.png"]));

    expect([...store.keys()].filter((key) => key.startsWith("notes/"))).toEqual([]);
    expect(await cache.getSource(slug)).toBe("# New\n");
    expect((await cache.getAsset(slug, "cover.png"))?.bytes).toEqual(new Uint8Array([1]));
  });

  it("deletes the former copies together with the new ones", async () => {
    const { bucket, store } = createTestR2();
    putFormer(store);
    const cache = new R2ArticleContentCache(bucket);
    await cache.putSource(slug, "# New\n");

    await cache.deleteArticle(slug);

    expect(store.size).toBe(0);
  });
});
