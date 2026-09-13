import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type { IWorkContentCache, WorkSlug } from "~/backend/domain/work";
import type { CachedAsset } from "~/backend/domain/shared";
import type { Nodes, Root } from "mdast";
import { beforeEach, describe, expect, it } from "vitest";
import { WorksRefreshService } from "./works-refresh.service";
import { D1WorkCommandRepository, D1WorkQueryRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

const WORK_MD = `---
name: infoholick
summary: 読んだものを覚えておくやつ。
url: https://github.com/yantene/infoholick
position: 0
---

詳しい説明。

![図](./diagram.png)
`;

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * ツリーを訊かれるたびに `files` の今の姿を返す。本物は 1 回の同期で 1 つ作り、その間
 * 同じ姿を返す約束だが (`IContentStore`)、ここでは 1 つのストアで何回もの同期を模して
 * コンテンツリポジトリ側の書き換えを起こしたいので、わざとそうしていない。
 */
class MockContentStore implements IContentStore {
  /** 読みに行ったパス。「変更が無ければ開かない」を確かめるために控える。 */
  readonly reads: string[] = [];
  /** ツリーには在るのに読めないパス (infra 障害を起こすため)。 */
  readonly unreadable = new Set<string>();

  constructor(private readonly files: Map<string, { hash: string; bytes: Uint8Array }>) {}

  listTree(): Promise<readonly ContentEntry[]> {
    return Promise.resolve([...this.files].map(([path, file]) => ({ path, hash: file.hash })));
  }

  readFile(path: string): Promise<Uint8Array | undefined> {
    this.reads.push(path);
    if (this.unreadable.has(path)) return Promise.resolve(undefined);
    return Promise.resolve(this.files.get(path)?.bytes);
  }
}

class InMemoryCache implements IWorkContentCache {
  readonly sources = new Map<string, string>();
  readonly mdasts = new Map<string, unknown>();
  readonly assets = new Map<string, CachedAsset>();
  readonly deleted: string[] = [];

  putSource(slug: WorkSlug, markdown: string): Promise<void> {
    this.sources.set(slug.toString(), markdown);
    return Promise.resolve();
  }

  getSource(slug: WorkSlug): Promise<string | undefined> {
    return Promise.resolve(this.sources.get(slug.toString()));
  }

  putMdast(slug: WorkSlug, mdast: unknown): Promise<void> {
    this.mdasts.set(slug.toString(), mdast);
    return Promise.resolve();
  }

  getMdast(slug: WorkSlug): Promise<unknown> {
    return Promise.resolve(this.mdasts.get(slug.toString()));
  }

  putAsset(slug: WorkSlug, path: string, asset: CachedAsset): Promise<void> {
    this.assets.set(`${slug.toString()}/${path}`, asset);
    return Promise.resolve();
  }

  getAsset(slug: WorkSlug, path: string): Promise<CachedAsset | undefined> {
    return Promise.resolve(this.assets.get(`${slug.toString()}/${path}`));
  }

  pruneAssets(slug: WorkSlug, keep: ReadonlySet<string>): Promise<void> {
    const prefix = `${slug.toString()}/`;
    for (const key of this.assets.keys()) {
      if (!key.startsWith(prefix)) continue;
      if (!keep.has(key.slice(prefix.length))) this.assets.delete(key);
    }
    return Promise.resolve();
  }

  deleteWork(slug: WorkSlug): Promise<void> {
    const name = slug.toString();
    this.deleted.push(name);
    this.sources.delete(name);
    this.mdasts.delete(name);
    for (const key of this.assets.keys()) {
      if (key.startsWith(`${name}/`)) this.assets.delete(key);
    }
    return Promise.resolve();
  }
}

function collectByType(node: Nodes, type: string): Nodes[] {
  const found: Nodes[] = node.type === type ? [node] : [];
  if ("children" in node) {
    for (const child of node.children) found.push(...collectByType(child, type));
  }
  return found;
}

let files: Map<string, { hash: string; bytes: Uint8Array }>;
let service: WorksRefreshService;
let content: MockContentStore;
let cache: InMemoryCache;
let query: D1WorkQueryRepository;

beforeEach(() => {
  files = new Map([
    ["works/infoholick.md", { hash: "h-md", bytes: bytes(WORK_MD) }],
    ["works/infoholick/diagram.png", { hash: "h-asset", bytes: bytes("diagram") }],
    // 記事もツリーに居る。作品の同期がこれを拾わないこと。
    ["articles/hello.md", { hash: "h-article", bytes: bytes("---\ntitle: x\n---\n") }],
  ]);
  const d1 = createTestD1();
  content = new MockContentStore(files);
  cache = new InMemoryCache();
  query = new D1WorkQueryRepository(d1);
  service = new WorksRefreshService(content, new D1WorkCommandRepository(d1), query, cache);
});

describe("WorksRefreshService", () => {
  it("syncs a work into D1 and R2", async () => {
    const result = await service.refresh();

    expect(result.processed).toEqual(["infoholick"]);
    expect(result.skipped).toEqual([]);

    const [work] = await query.list();
    expect(work?.name.toString()).toBe("infoholick");
    expect(work?.summary.toString()).toBe("読んだものを覚えておくやつ。");
    expect(work?.url?.toString()).toBe("https://github.com/yantene/infoholick");
    expect(work?.position).toBe(0);

    expect(cache.sources.get("infoholick")).toBe(WORK_MD);
    expect(cache.assets.get("infoholick/diagram.png")).toBeDefined();
  });

  /** 記事の同期と同じツリーを見るので、articles/ を拾わないことを押さえておく。 */
  it("does not read files outside works/", async () => {
    await service.refresh();
    expect(content.reads).toEqual(["works/infoholick.md", "works/infoholick/diagram.png"]);
  });

  /** 本文の画像も、コンテンツリポジトリの URL を出さずアセット API 経由で配る。 */
  it("resolves the body images to the asset API", async () => {
    await service.refresh();

    const [image] = collectByType(cache.mdasts.get("infoholick") as Root, "image");
    expect(image).toMatchObject({ url: "/api/v1/works/infoholick/assets/diagram.png" });
  });

  it("skips reading the source when nothing changed", async () => {
    await service.refresh();
    content.reads.length = 0;

    const result = await service.refresh();
    expect(result.processed).toEqual([]);
    expect(content.reads).toEqual([]);
  });

  it("reads again when the source hash changes", async () => {
    await service.refresh();
    content.reads.length = 0;

    files.set("works/infoholick.md", { hash: "h-md-2", bytes: bytes(WORK_MD) });
    expect((await service.refresh()).processed).toEqual(["infoholick"]);
  });

  /** アセットを差し替えただけでも合成ハッシュが変わるので読み直す。 */
  it("reads again when only an asset changed", async () => {
    await service.refresh();

    files.set("works/infoholick/diagram.png", { hash: "h-asset-2", bytes: bytes("diagram2") });
    expect((await service.refresh()).processed).toEqual(["infoholick"]);
  });

  it("reads again on force even when nothing changed", async () => {
    await service.refresh();
    expect((await service.refresh({ force: true })).processed).toEqual(["infoholick"]);
  });

  it("cleans up D1 and R2 when the source disappears", async () => {
    await service.refresh();

    files.delete("works/infoholick.md");
    files.delete("works/infoholick/diagram.png");
    files.set("works/arerd.md", {
      hash: "h-arerd",
      bytes: bytes("---\nname: arerd\nsummary: あれだ。\nposition: 1\n---\n"),
    });
    const result = await service.refresh();

    expect(result.deleted).toEqual(["infoholick"]);
    expect(cache.deleted).toEqual(["infoholick"]);
    expect((await query.list()).map((work) => work.slug.toString())).toEqual(["arerd"]);
  });

  /*
   * ブランチの取り違えやコンテンツリポジトリ側の事故で `works/` を持たない応答が返ると、
   * 掃除の経路がそのまま全件削除になる。
   */
  it("refuses to delete every work when works/ disappears", async () => {
    await service.refresh();

    files.delete("works/infoholick.md");
    files.delete("works/infoholick/diagram.png");

    await expect(service.refresh()).rejects.toThrow("refusing to delete all 1 work(s)");
    expect(await query.list()).toHaveLength(1);
  });

  it("does nothing when there are no works at all", async () => {
    files.clear();

    const result = await service.refresh();
    expect(result).toEqual({ processed: [], deleted: [], skipped: [], linkedUrls: [] });
  });

  it("drops assets that are no longer in the content repository", async () => {
    await service.refresh();

    files.delete("works/infoholick/diagram.png");
    files.set("works/infoholick.md", {
      hash: "h-md-2",
      bytes: bytes(WORK_MD.replace("![図](./diagram.png)\n", "")),
    });
    await service.refresh();
    expect(cache.assets.has("infoholick/diagram.png")).toBe(false);
  });

  it("collects bare link URLs from the body for link cards", async () => {
    files.set("works/infoholick.md", {
      hash: "h-md-linked",
      bytes: bytes(`${WORK_MD}\nhttps://example.com/\n`),
    });
    expect((await service.refresh()).linkedUrls).toContain("https://example.com/");
  });

  it("ignores file names that cannot be a slug", async () => {
    files.set("works/Bad--Name.md", { hash: "h-bad", bytes: bytes(WORK_MD) });
    expect((await service.refresh()).processed).toEqual(["infoholick"]);
  });
});

describe("読めない作品", () => {
  /*
   * 誤字 1 つで、出ている作品が `/about` と `/works` から消えては困る。読めなかった
   * ときは前回の姿をそのまま残し、理由だけを返す。
   */
  it.each([
    ["名前が無い", "---\nsummary: あれだ。\nposition: 0\n---\n"],
    ["概要が無い", "---\nname: arerd\nposition: 0\n---\n"],
    ["並び順が無い", "---\nname: arerd\nsummary: あれだ。\n---\n"],
    ["並び順が整数でない", "---\nname: arerd\nsummary: あれだ。\nposition: 1.5\n---\n"],
    ["並び順が負", "---\nname: arerd\nsummary: あれだ。\nposition: -1\n---\n"],
    [
      "在り処が相対パス",
      "---\nname: arerd\nsummary: あれだ。\nposition: 0\nurl: /works/arerd\n---\n",
    ],
    ["概要が 2 行", "---\nname: arerd\nsummary: |\n  1 行目\n  2 行目\nposition: 0\n---\n"],
  ])("%s のときはスキップして前の姿を残す", async (_label, markdown) => {
    await service.refresh();

    files.set("works/infoholick.md", { hash: "h-broken", bytes: bytes(markdown) });
    const result = await service.refresh();

    expect(result.processed).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.path).toBe("works/infoholick.md");
    expect((await query.list())[0]?.name.toString()).toBe("infoholick");
  });

  /** 直したら次の refresh で拾われること (壊れた版でハッシュを進めていない)。 */
  it("picks the work up again once the writer fixes it", async () => {
    await service.refresh();

    files.set("works/infoholick.md", { hash: "h-broken", bytes: bytes("---\nname: x\n---\n") });
    await service.refresh();

    files.set("works/infoholick.md", {
      hash: "h-fixed",
      bytes: bytes(WORK_MD.replace("name: infoholick", "name: infoholick (改)")),
    });
    expect((await service.refresh()).processed).toEqual(["infoholick"]);
    expect((await query.list())[0]?.name.toString()).toBe("infoholick (改)");
  });

  /** ツリーに在るのに読めないのは infra 障害。スキップに落とさず送出する (fail-loud)。 */
  it("propagates infra errors instead of skipping them", async () => {
    content.unreadable.add("works/infoholick.md");
    await expect(service.refresh()).rejects.toThrow("source file could not be read");
  });
});
