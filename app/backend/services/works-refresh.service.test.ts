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

/** PNG: シグネチャ + IHDR (幅・高さは big-endian 32bit)。寸法を読ませるための最小の姿。 */
function pngOf(width: number, height: number): Uint8Array {
  const png = new Uint8Array(24);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(png.buffer);
  view.setUint32(8, 13);
  png.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return png;
}

/** 必須の欄だけを書いた作品に、足した欄を添える。 */
function workWith(extra: string): Uint8Array {
  return bytes(
    `---\nname: infoholick\nsummary: 読んだものを覚えておくやつ。\nposition: 0\n${extra}---\n\n本文。\n`,
  );
}

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
/** 記事として存在する slug。関連記事の警告はこれと突き合わせる。 */
let knownArticles: Set<string>;

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
  knownArticles = new Set(["hello"]);
  service = new WorksRefreshService(content, new D1WorkCommandRepository(d1), query, cache, {
    listSourceHashes: () =>
      Promise.resolve(new Map([...knownArticles].map((slug) => [slug, "hash"]))),
  });
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
    expect(result).toEqual({
      processed: [],
      deleted: [],
      skipped: [],
      warnings: [],
      linkedUrls: [],
    });
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

  /* 執筆の材料は `_` で始まる名前に置けば同期されない (#559)。 */
  it("does not sync paths with a segment starting with _", async () => {
    files.set("works/infoholick/_x", { hash: "h-x", bytes: bytes("secret") });
    files.set("works/infoholick/img/_draft.png", { hash: "h-draft", bytes: bytes("draft") });

    await service.refresh();
    expect([...cache.assets.keys()]).toEqual(["infoholick/diagram.png"]);
    expect(content.reads).toEqual(["works/infoholick.md", "works/infoholick/diagram.png"]);
  });

  it("does not resync when only a path starting with _ changes", async () => {
    files.set("works/infoholick/_x", { hash: "h-x", bytes: bytes("v1") });
    await service.refresh();

    files.set("works/infoholick/_x", { hash: "h-x-2", bytes: bytes("v2") });
    expect((await service.refresh()).processed).toEqual([]);
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

describe("足した欄", () => {
  /** 既存の作品はどの欄も書いていない。今までどおり同期されること。 */
  it("syncs a work that writes none of the added fields", async () => {
    const result = await service.refresh();

    expect(result.processed).toEqual(["infoholick"]);
    expect(result.warnings).toEqual([]);
    const [work] = await query.list();
    expect(work?.featured).toBe(false);
    expect(work?.stack.toArray()).toEqual([]);
    expect(work?.period).toBeUndefined();
    expect(work?.role).toBeUndefined();
    expect(work?.screenshots).toEqual([]);
    expect(work?.articleSlugs).toEqual([]);
  });

  it("stores featured, stack, period and role", async () => {
    files.set("works/infoholick.md", {
      hash: "h-fields",
      bytes: workWith(
        "featured: true\nstack: [TypeScript, Hono]\nperiod:\n  from: 2024-06\n  until: 2025-03\nrole: 設計から運用まで\n",
      ),
    });
    await service.refresh();

    const [work] = await query.list();
    expect(work?.featured).toBe(true);
    expect(work?.stack.toArray()).toEqual(["TypeScript", "Hono"]);
    expect(work?.period?.toJSON()).toEqual({ from: "2024-06", until: "2025-03" });
    expect(work?.role?.toString()).toBe("設計から運用まで");
  });
});

describe("スクリーンショット", () => {
  const SHOTS =
    "screenshots:\n  - src: ./top.png\n    alt: トップ画面\n  - src: shots/reader.png\n    alt: 記事を開いた画面\n    kind: mobile\n";

  beforeEach(() => {
    files.set("works/infoholick.md", { hash: "h-shots", bytes: workWith(SHOTS) });
    files.set("works/infoholick/top.png", { hash: "h-top", bytes: pngOf(1600, 900) });
    files.set("works/infoholick/shots/reader.png", { hash: "h-reader", bytes: pngOf(450, 950) });
  });

  /** コンテンツリポジトリの URL は出さない。本文の画像と同じアセット API に解決する。 */
  it("resolves src to the asset API and fills in the dimensions", async () => {
    await service.refresh();

    const [work] = await query.list();
    expect(work?.screenshots.map((screenshot) => screenshot.toJSON())).toEqual([
      {
        src: "/api/v1/works/infoholick/assets/top.png",
        alt: "トップ画面",
        kind: "desktop",
        width: 1600,
        height: 900,
      },
      {
        src: "/api/v1/works/infoholick/assets/shots/reader.png",
        alt: "記事を開いた画面",
        kind: "mobile",
        width: 450,
        height: 950,
      },
    ]);
  });

  /** 寸法を読めない形式でも作品は同期する。誤った寸法を付けるより、付けないほうが安全。 */
  it("keeps a screenshot whose dimensions cannot be read, without dimensions", async () => {
    files.set("works/infoholick/top.png", { hash: "h-top-2", bytes: bytes("not an image") });
    await service.refresh();

    const [work] = await query.list();
    expect(work?.screenshots[0]?.dimensions).toBeUndefined();
    expect(work?.screenshots[1]?.dimensions).toEqual({ width: 450, height: 950 });
  });

  /** 入れ替えたら前の並びは残らない (消してから入れ直す)。 */
  it("replaces the screenshots on the next sync", async () => {
    await service.refresh();

    files.set("works/infoholick.md", {
      hash: "h-shots-2",
      bytes: workWith("screenshots:\n  - src: ./top.png\n    alt: 新しいトップ画面\n"),
    });
    await service.refresh();

    const [work] = await query.list();
    expect(work?.screenshots.map((screenshot) => screenshot.alt)).toEqual(["新しいトップ画面"]);
  });

  /*
   * 置き場に無いものを指した作品は、作品ごと諦めて前の姿を残す。通すと見せ場に割れた絵が
   * 出る。`_` で始まるパスは同期で落とすので、ツリーに在っても「置き場に無い」側に入る。
   */
  it.each([
    ["置き場に無いファイル", "./missing.png"],
    ["_ で始まるファイル", "./_draft.png"],
    ["_ で始まるディレクトリの下", "./_materials/top.png"],
    ["外の URL", "https://example.com/top.png"],
    ["置き場の外 (../)", "../other/top.png"],
    ["ルート相対", "/api/v1/works/infoholick/assets/top.png?v=2"],
  ])("%s を指したらスキップして前の姿を残す", async (_label, src) => {
    files.set("works/infoholick/_draft.png", { hash: "h-draft", bytes: pngOf(10, 10) });
    files.set("works/infoholick/_materials/top.png", { hash: "h-mat", bytes: pngOf(10, 10) });
    await service.refresh();
    const assetsBefore = [...cache.assets.keys()];

    files.set("works/infoholick.md", {
      hash: "h-bad-src",
      bytes: workWith(`screenshots:\n  - src: ${src}\n    alt: 画面\n`),
    });
    const result = await service.refresh();

    expect(result.processed).toEqual([]);
    expect(result.skipped).toEqual([
      {
        path: "works/infoholick.md",
        reason: `screenshot src is not a synced asset of this work: ${src}`,
      },
    ]);
    const [work] = await query.list();
    expect(work?.screenshots).toHaveLength(2);
    // R2 に書き始める前に引き返している (R2 だけが新しい姿にならない)。
    expect([...cache.assets.keys()]).toEqual(assetsBefore);
    expect(cache.sources.get("infoholick")).toContain("記事を開いた画面");
  });

  it("skips the work when a screenshot has no alt", async () => {
    files.set("works/infoholick.md", {
      hash: "h-no-alt",
      bytes: workWith("screenshots:\n  - src: ./top.png\n"),
    });
    const result = await service.refresh();

    expect(result.processed).toEqual([]);
    expect(result.skipped[0]?.reason).toContain("screenshots[0].alt");
  });
});

describe("関連記事", () => {
  it("stores the article slugs in the written order", async () => {
    knownArticles = new Set(["hello", "second"]);
    files.set("works/infoholick.md", {
      hash: "h-articles",
      bytes: workWith("articles:\n  - second\n  - hello\n"),
    });
    const result = await service.refresh();

    expect(result.warnings).toEqual([]);
    const [work] = await query.list();
    expect(work?.articleSlugs.map((slug) => slug.toString())).toEqual(["second", "hello"]);
  });

  /*
   * 作品と記事のどちらが先に同期されるかで結果が変わらないように、無い記事の slug でも
   * 作品は同期する。書き手には警告で知らせる。
   */
  it("syncs the work and warns about a slug no article has", async () => {
    files.set("works/infoholick.md", {
      hash: "h-articles",
      bytes: workWith("articles:\n  - hello\n  - not-yet-written\n"),
    });
    const result = await service.refresh();

    expect(result.processed).toEqual(["infoholick"]);
    expect(result.skipped).toEqual([]);
    expect(result.warnings).toEqual([
      { path: "works/infoholick.md", reason: "articles lists an unknown slug: not-yet-written" },
    ]);
    const [work] = await query.list();
    expect(work?.articleSlugs.map((slug) => slug.toString())).toEqual(["hello", "not-yet-written"]);
  });

  /** 読み直さなかった回にも出す。出さないと、直っていない誤りが直ったように見える。 */
  it("keeps warning on later syncs that do not reprocess the work", async () => {
    files.set("works/infoholick.md", {
      hash: "h-articles",
      bytes: workWith("articles:\n  - not-yet-written\n"),
    });
    await service.refresh();

    const result = await service.refresh();
    expect(result.processed).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  /** 記事が入れば、作品を触らなくても警告は消える。 */
  it("stops warning once the article exists", async () => {
    files.set("works/infoholick.md", {
      hash: "h-articles",
      bytes: workWith("articles:\n  - not-yet-written\n"),
    });
    await service.refresh();

    knownArticles.add("not-yet-written");
    expect((await service.refresh()).warnings).toEqual([]);
  });
});
