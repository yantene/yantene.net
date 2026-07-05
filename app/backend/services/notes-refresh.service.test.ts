import { describe, expect, it } from "vitest";
import { NotesRefreshService } from "./notes-refresh.service";
import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type { CachedAsset, INoteContentCache } from "~/backend/domain/note";
import { NoteSlug } from "~/backend/domain/note";
import {
  D1NoteCommandRepository,
  D1NoteQueryRepository,
} from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

class MockContentStore implements IContentStore {
  constructor(
    private readonly files: Map<string, { hash: string; bytes: Uint8Array }>,
  ) {}

  listTree(): Promise<readonly ContentEntry[]> {
    return Promise.resolve(
      [...this.files].map(([path, { hash }]) => ({ path, hash })),
    );
  }

  readFile(path: string): Promise<Uint8Array | undefined> {
    return Promise.resolve(this.files.get(path)?.bytes);
  }
}

class InMemoryCache implements INoteContentCache {
  readonly mdasts = new Map<string, unknown>();
  readonly assets = new Map<string, CachedAsset>();

  putMdast(slug: NoteSlug, mdast: unknown): Promise<void> {
    this.mdasts.set(slug.toString(), mdast);
    return Promise.resolve();
  }
  getMdast(slug: NoteSlug): Promise<unknown> {
    return Promise.resolve(this.mdasts.get(slug.toString()));
  }
  putAsset(slug: NoteSlug, path: string, asset: CachedAsset): Promise<void> {
    this.assets.set(`${slug.toString()}::${path}`, asset);
    return Promise.resolve();
  }
  getAsset(slug: NoteSlug, path: string): Promise<CachedAsset | undefined> {
    return Promise.resolve(this.assets.get(`${slug.toString()}::${path}`));
  }
  deleteNote(slug: NoteSlug): Promise<void> {
    this.mdasts.delete(slug.toString());
    const prefix = `${slug.toString()}::`;
    for (const key of this.assets.keys()) {
      if (key.startsWith(prefix)) this.assets.delete(key);
    }
    return Promise.resolve();
  }
}

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const helloMd = `---
title: Hello
imageUrl: ./cover.png
publishedOn: 2026-01-15
lastModifiedOn: 2026-01-16
---

Body with an inline image ![alt](./inline.png).
`;

function setup(files: Map<string, { hash: string; bytes: Uint8Array }>): {
  service: NotesRefreshService;
  command: D1NoteCommandRepository;
  query: D1NoteQueryRepository;
  cache: InMemoryCache;
} {
  const d1 = createTestD1();
  const command = new D1NoteCommandRepository(d1);
  const query = new D1NoteQueryRepository(d1);
  const cache = new InMemoryCache();
  const service = new NotesRefreshService(
    new MockContentStore(files),
    command,
    query,
    cache,
  );
  return { service, command, query, cache };
}

describe("NotesRefreshService", () => {
  it("indexes a note, caches its MDAST and assets, resolves image URLs", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
      ["notes/hello/cover.png", { hash: "a1", bytes: bytes("PNG") }],
      ["notes/hello/inline.png", { hash: "a2", bytes: bytes("PNG2") }],
    ]);
    const { service, query, cache } = setup(files);

    const result = await service.refresh();
    expect(result.processed).toEqual(["hello"]);
    expect(result.skipped).toEqual([]);

    const note = await query.findBySlug(NoteSlug.create("hello"));
    expect(note?.title.toString()).toBe("Hello");
    expect(note?.imageUrl?.toString()).toBe(
      "/api/v1/notes/hello/assets/cover.png",
    );
    // sourceHash は md + アセットの合成ハッシュ (生の blob ハッシュではない)。
    expect(note?.sourceHash).toMatch(/^[0-9a-f]{8}$/);
    expect(note?.summary).toContain("Body with an inline image");

    // アセットが R2 キャッシュに入る。
    expect(cache.assets.has("hello::cover.png")).toBe(true);
    expect(cache.assets.has("hello::inline.png")).toBe(true);

    // 本文 MDAST の画像 URL がアセット API URL に解決されている。
    const mdastJson = JSON.stringify(cache.mdasts.get("hello"));
    expect(mdastJson).toContain("/api/v1/notes/hello/assets/inline.png");
  });

  it("skips unchanged notes on a second refresh (hash match)", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
    ]);
    const { service } = setup(files);

    await service.refresh();
    const second = await service.refresh();
    expect(second.processed).toEqual([]);
  });

  it("reprocesses a note when its hash changes", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
    ]);
    const { service } = setup(files);

    await service.refresh();
    files.set("notes/hello.md", { hash: "h2", bytes: bytes(helloMd) });
    const second = await service.refresh();
    expect(second.processed).toEqual(["hello"]);
  });

  it("deletes notes removed from the tree", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
    ]);
    const { service, query, cache } = setup(files);

    await service.refresh();
    files.delete("notes/hello.md");
    const result = await service.refresh();

    expect(result.deleted).toEqual(["hello"]);
    expect(await query.findBySlug(NoteSlug.create("hello"))).toBeUndefined();
    expect(cache.mdasts.has("hello")).toBe(false);
  });

  it("skips notes with invalid frontmatter (missing publishedOn)", async () => {
    const files = new Map([
      [
        "notes/bad.md",
        { hash: "b1", bytes: bytes("---\ntitle: Bad\n---\n\nBody.\n") },
      ],
    ]);
    const { service, query } = setup(files);

    const result = await service.refresh();
    expect(result.processed).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].path).toBe("notes/bad.md");
    expect(await query.findBySlug(NoteSlug.create("bad"))).toBeUndefined();
  });

  it("reprocesses when only an asset changes (image-only edit)", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
      ["notes/hello/cover.png", { hash: "a1", bytes: bytes("v1") }],
    ]);
    const { service } = setup(files);

    await service.refresh();
    // .md は据え置きで画像だけ差し替える。
    files.set("notes/hello/cover.png", { hash: "a2", bytes: bytes("v2") });
    const second = await service.refresh();
    expect(second.processed).toEqual(["hello"]);
  });

  it("prunes assets that were removed or renamed", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
      ["notes/hello/old.png", { hash: "a1", bytes: bytes("old") }],
    ]);
    const { service, cache } = setup(files);

    await service.refresh();
    expect(cache.assets.has("hello::old.png")).toBe(true);

    // old.png を new.png にリネーム (+ .md も更新して再処理させる)。
    files.delete("notes/hello/old.png");
    files.set("notes/hello/new.png", { hash: "a2", bytes: bytes("new") });
    files.set("notes/hello.md", { hash: "h2", bytes: bytes(helloMd) });
    await service.refresh();

    expect(cache.assets.has("hello::old.png")).toBe(false);
    expect(cache.assets.has("hello::new.png")).toBe(true);
  });

  it("propagates infra errors (fail-loud) instead of skipping them", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
    ]);
    const { service, cache } = setup(files);
    // R2 書き込みが落ちる状況を再現する。
    cache.putMdast = () => Promise.reject(new Error("R2 down"));

    await expect(service.refresh()).rejects.toThrow("R2 down");
  });
});
