import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type { ISlideContentCache, SlideSlug } from "~/backend/domain/slide";
import type { CachedAsset } from "~/backend/domain/shared";
import type { Nodes, Root } from "mdast";
import { beforeEach, describe, expect, it } from "vitest";
import { SlidesRefreshService } from "./slides-refresh.service";
import { D1SlideCommandRepository, D1SlideQueryRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

const SLIDE_MD = `---
title: 意味だけで書くスライド
publishedOn: 2026-11-14
event:
  name: yantene.rb
  date: 2026-11-13
  url: https://example.com/events/1
---

表紙で話すこと。

## 図のページ

![図](./diagram.png)

このページで話すこと。
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

/** 必須の欄だけを書いたスライドに、本文を添える。 */
function slideWith(body: string): Uint8Array {
  return bytes(`---\ntitle: 意味だけで書くスライド\npublishedOn: 2026-11-14\n---\n\n${body}`);
}

/** 項目が多すぎて、どう数えても 1 ページに入りきらないページ。 */
const OVERFULL_BODY = `## 詰め込みすぎ\n\n${Array.from({ length: 20 }, (_unused, index) => `- 項目 ${String(index)}`).join("\n")}\n`;

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

class InMemoryCache implements ISlideContentCache {
  readonly sources = new Map<string, string>();
  readonly mdasts = new Map<string, unknown>();
  readonly assets = new Map<string, CachedAsset>();
  readonly deleted: string[] = [];

  putSource(slug: SlideSlug, markdown: string): Promise<void> {
    this.sources.set(slug.toString(), markdown);
    return Promise.resolve();
  }

  getSource(slug: SlideSlug): Promise<string | undefined> {
    return Promise.resolve(this.sources.get(slug.toString()));
  }

  putMdast(slug: SlideSlug, mdast: unknown): Promise<void> {
    this.mdasts.set(slug.toString(), mdast);
    return Promise.resolve();
  }

  getMdast(slug: SlideSlug): Promise<unknown> {
    return Promise.resolve(this.mdasts.get(slug.toString()));
  }

  putAsset(slug: SlideSlug, path: string, asset: CachedAsset): Promise<void> {
    this.assets.set(`${slug.toString()}/${path}`, asset);
    return Promise.resolve();
  }

  getAsset(slug: SlideSlug, path: string): Promise<CachedAsset | undefined> {
    return Promise.resolve(this.assets.get(`${slug.toString()}/${path}`));
  }

  pruneAssets(slug: SlideSlug, keep: ReadonlySet<string>): Promise<void> {
    const prefix = `${slug.toString()}/`;
    for (const key of this.assets.keys()) {
      if (!key.startsWith(prefix)) continue;
      if (!keep.has(key.slice(prefix.length))) this.assets.delete(key);
    }
    return Promise.resolve();
  }

  deleteSlide(slug: SlideSlug): Promise<void> {
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
let service: SlidesRefreshService;
let content: MockContentStore;
let cache: InMemoryCache;
let query: D1SlideQueryRepository;

beforeEach(() => {
  files = new Map([
    ["slides/semantic-slides.md", { hash: "h-md", bytes: bytes(SLIDE_MD) }],
    ["slides/semantic-slides/diagram.png", { hash: "h-asset", bytes: pngOf(1600, 900) }],
    // 記事と作品もツリーに居る。スライドの同期がこれらを拾わないこと。
    ["articles/hello.md", { hash: "h-article", bytes: bytes("---\ntitle: x\n---\n") }],
    ["works/infoholick.md", { hash: "h-work", bytes: bytes("---\nname: x\n---\n") }],
  ]);
  const d1 = createTestD1();
  content = new MockContentStore(files);
  cache = new InMemoryCache();
  query = D1SlideQueryRepository.forAdmin(d1);
  service = new SlidesRefreshService(content, new D1SlideCommandRepository(d1), query, cache);
});

describe("SlidesRefreshService", () => {
  it("syncs a slide into D1 and R2", async () => {
    const result = await service.refresh();

    expect(result.processed).toEqual(["semantic-slides"]);
    expect(result.skipped).toEqual([]);
    expect(result.warnings).toEqual([]);

    const [slide] = await query.list();
    expect(slide?.title.toString()).toBe("意味だけで書くスライド");
    expect(slide?.publishedOn.toString()).toBe("2026-11-14");
    expect(slide?.event?.toJSON()).toEqual({
      name: "yantene.rb",
      date: "2026-11-13",
      url: "https://example.com/events/1",
    });

    expect(cache.sources.get("semantic-slides")).toBe(SLIDE_MD);
    expect(cache.assets.get("semantic-slides/diagram.png")).toBeDefined();
  });

  /** 要約になるのは語りだけ。図の alt やページの題は混ざらない。 */
  it("summarizes the narration", async () => {
    await service.refresh();

    expect((await query.list())[0]?.summary).toBe("表紙で話すこと。 このページで話すこと。");
  });

  /** 表紙 + `##` の 1 ページ。数えるのは R2 に置いたのと同じ木。 */
  it("counts the pages, cover included", async () => {
    await service.refresh();

    expect((await query.list())[0]?.pageCount).toBe(2);
  });

  it("does not read files outside slides/", async () => {
    await service.refresh();

    expect(content.reads.every((path) => path.startsWith("slides/"))).toBe(true);
  });

  it("resolves the body images to the asset API and fills in the dimensions", async () => {
    await service.refresh();

    const [image] = collectByType(cache.mdasts.get("semantic-slides") as Root, "image");
    expect(image).toMatchObject({
      url: "/api/v1/slides/semantic-slides/assets/diagram.png",
      data: { hProperties: { width: 1600, height: 900 } },
    });
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

    files.set("slides/semantic-slides.md", {
      hash: "h-md-2",
      bytes: bytes(SLIDE_MD.replace("意味だけで書くスライド", "改めた題")),
    });

    expect((await service.refresh()).processed).toEqual(["semantic-slides"]);
    expect((await query.list())[0]?.title.toString()).toBe("改めた題");
  });

  it("reads again when only an asset changed", async () => {
    await service.refresh();

    files.set("slides/semantic-slides/diagram.png", { hash: "h-asset-2", bytes: pngOf(900, 1600) });

    expect((await service.refresh()).processed).toEqual(["semantic-slides"]);
  });

  it("reads again on force even when nothing changed", async () => {
    await service.refresh();

    expect((await service.refresh({ force: true })).processed).toEqual(["semantic-slides"]);
  });

  it("cleans up D1 and R2 when the source disappears", async () => {
    files.set("slides/other.md", { hash: "h-other", bytes: slideWith("語り。\n") });
    await service.refresh();

    files.delete("slides/other.md");
    const result = await service.refresh();

    expect(result.deleted).toEqual(["other"]);
    expect(cache.deleted).toEqual(["other"]);
    expect((await query.list()).map((slide) => slide.slug.toString())).toEqual(["semantic-slides"]);
  });

  /*
   * 空のツリーを「全部消してよい」の合図として受け取らない。ブランチの取り違えで
   * `slides/` を持たない応答が返ると、掃除の経路がそのまま全件削除になる。
   */
  it("refuses to delete every slide when slides/ disappears", async () => {
    await service.refresh();

    files.delete("slides/semantic-slides.md");
    files.delete("slides/semantic-slides/diagram.png");

    await expect(service.refresh()).rejects.toThrow("refusing to delete all 1 slide(s)");
    expect(await query.list()).toHaveLength(1);
  });

  /** まだ 1 本も無いサイトでは、ガードに掛からず何もしない。 */
  it("does nothing when there are no slides at all", async () => {
    files.delete("slides/semantic-slides.md");
    files.delete("slides/semantic-slides/diagram.png");

    expect(await service.refresh()).toEqual({
      processed: [],
      deleted: [],
      skipped: [],
      warnings: [],
      linkedUrls: [],
    });
  });

  it("drops assets that are no longer in the content repository", async () => {
    await service.refresh();

    files.delete("slides/semantic-slides/diagram.png");
    files.set("slides/semantic-slides.md", { hash: "h-md-2", bytes: slideWith("語り。\n") });
    await service.refresh();

    expect(cache.assets.has("semantic-slides/diagram.png")).toBe(false);
  });

  /* 執筆の材料 (`_materials/`) は R2 に写さない。写すと別の経路から漏れる余地が残る。 */
  it("does not sync paths with a segment starting with _", async () => {
    files.set("slides/semantic-slides/_materials/outline.md", {
      hash: "h-outline",
      bytes: bytes("骨組み"),
    });
    files.set("slides/semantic-slides/img/_draft.png", { hash: "h-draft", bytes: pngOf(1, 1) });
    await service.refresh();

    expect([...cache.assets.keys()]).toEqual(["semantic-slides/diagram.png"]);
    expect(content.reads).not.toContain("slides/semantic-slides/_materials/outline.md");
  });

  /** 材料はハッシュにも入れない。直しただけの push でスライドを作り直さない。 */
  it("does not resync when only a path starting with _ changes", async () => {
    files.set("slides/semantic-slides/_materials/outline.md", { hash: "h-1", bytes: bytes("a") });
    await service.refresh();

    files.set("slides/semantic-slides/_materials/outline.md", { hash: "h-2", bytes: bytes("b") });

    expect((await service.refresh()).processed).toEqual([]);
  });

  it("collects bare link URLs from the body for link cards", async () => {
    files.set("slides/semantic-slides.md", {
      hash: "h-md-2",
      bytes: slideWith("語り。\n\nhttps://example.com/reference\n"),
    });

    expect((await service.refresh()).linkedUrls).toEqual(["https://example.com/reference"]);
  });

  it("ignores file names that cannot be a slug", async () => {
    files.set("slides/Bad--Name.md", { hash: "h-bad", bytes: bytes(SLIDE_MD) });

    expect((await service.refresh()).processed).toEqual(["semantic-slides"]);
  });
});

describe("読めないスライド", () => {
  /*
   * 誤字 1 つで、出ているスライドが `/slides` から消えては困る。読めなかったときは
   * 前回の姿をそのまま残し、理由だけを返す。
   */
  it.each([
    ["題が無い", "---\npublishedOn: 2026-11-14\n---\n"],
    ["出した日が無い", "---\ntitle: 題\n---\n"],
    ["出した日が読めない", "---\ntitle: 題\npublishedOn: いつか\n---\n"],
    [
      "場に名前が無い",
      "---\ntitle: 題\npublishedOn: 2026-11-14\nevent:\n  date: 2026-11-13\n---\n",
    ],
    [
      "場の URL が相対パス",
      "---\ntitle: 題\npublishedOn: 2026-11-14\nevent:\n  name: x\n  url: /events/1\n---\n",
    ],
  ])("%s のときはスキップして前の姿を残す", async (_label, markdown) => {
    await service.refresh();

    files.set("slides/semantic-slides.md", { hash: "h-broken", bytes: bytes(markdown) });
    const result = await service.refresh();

    expect(result.processed).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.path).toBe("slides/semantic-slides.md");
    expect((await query.list())[0]?.title.toString()).toBe("意味だけで書くスライド");
    // R2 の写しも前のまま。読めない版で本文だけが入れ替わっていないこと。
    expect(cache.sources.get("semantic-slides")).toBe(SLIDE_MD);
  });

  /** 直したら次の refresh で拾われること (壊れた版でハッシュを進めていない)。 */
  it("picks the slide up again once the writer fixes it", async () => {
    await service.refresh();

    files.set("slides/semantic-slides.md", {
      hash: "h-broken",
      bytes: bytes("---\ntitle: x\n---\n"),
    });
    await service.refresh();

    files.set("slides/semantic-slides.md", {
      hash: "h-fixed",
      bytes: bytes(SLIDE_MD.replace("意味だけで書くスライド", "直した題")),
    });
    expect((await service.refresh()).processed).toEqual(["semantic-slides"]);
    expect((await query.list())[0]?.title.toString()).toBe("直した題");
  });

  /** ツリーに在るのに読めないのは infra 障害。スキップに落とさず送出する (fail-loud)。 */
  it("propagates infra errors instead of skipping them", async () => {
    content.unreadable.add("slides/semantic-slides.md");

    await expect(service.refresh()).rejects.toThrow("source file could not be read");
  });
});

/*
 * 1 ページに入りきらない量 (ADR 0052)。縮めて押し込まず、警告として返す。
 *
 * 目安の数は `~/lib/slides/overfull` が持ち、テーマに合わせて動く。ここでは数そのものを
 * 固定せず、どう数えても溢れる量を置いて「警告の形」と「止めないこと」だけを見る。
 */
describe("Overfull の警告", () => {
  beforeEach(() => {
    files.set("slides/crowded.md", { hash: "h-crowded", bytes: slideWith(OVERFULL_BODY) });
  });

  it("syncs the slide and warns about the overfull page", async () => {
    const result = await service.refresh();

    // 止めない。量が多くてもスライドは同期する。
    expect(result.processed).toContain("crowded");
    expect(result.skipped).toEqual([]);
    expect((await query.list()).map((slide) => slide.slug.toString())).toContain("crowded");

    // 表紙が 1 ページ目なので、最初の `##` は 2 ページ目。同じページに別の理由 (字の数
    // など) が並ぶことはあるので、件数は固定しない。
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(new Set(result.warnings.map((warning) => warning.path))).toEqual(
      new Set(["slides/crowded.md"]),
    );
    expect(result.warnings.every((warning) => warning.reason.startsWith("page 2: "))).toBe(true);
    expect(result.warnings.map((warning) => warning.reason)).toContainEqual(
      expect.stringMatching(/^page 2: \d+ list items \(at most \d+\)$/),
    );
  });

  /*
   * 読み直したスライドだけに出すと、次の push で警告が消えて、直っていない量が
   * 直ったように見える。
   */
  it("keeps warning on later syncs that do not reprocess the slide", async () => {
    await service.refresh();

    const result = await service.refresh();

    expect(result.processed).toEqual([]);
    expect(new Set(result.warnings.map((warning) => warning.path))).toEqual(
      new Set(["slides/crowded.md"]),
    );
  });

  it("stops warning once the writer splits the page", async () => {
    await service.refresh();

    files.set("slides/crowded.md", {
      hash: "h-split",
      bytes: slideWith("## 前半\n\n- 項目\n\n## 後半\n\n- 項目\n"),
    });

    expect((await service.refresh()).warnings).toEqual([]);
  });

  /*
   * D1 に在るのに R2 の MDAST が無い。ページの loader は投げるが、同期はここで投げない
   * (投げると、直す手立ての force refresh も同じ所で落ちる)。警告として知らせる。
   */
  it("warns instead of throwing when a stored slide has no MDAST", async () => {
    await service.refresh();
    cache.mdasts.delete("crowded");

    const result = await service.refresh();

    expect(result.warnings).toEqual([
      { path: "slides/crowded.md", reason: "MDAST cache is missing; run a force refresh" },
    ]);
  });
});

/*
 * 公開範囲 (ADR 0040)。**どの status のスライドも同期する。** 読み手から隠すのは配信の
 * 時点で、同期は status で分岐しない。
 */
describe("status", () => {
  function withStatus(line: string): Uint8Array {
    return bytes(SLIDE_MD.replace("publishedOn: 2026-11-14\n", `publishedOn: 2026-11-14\n${line}`));
  }

  it("書かなければ published として同期する", async () => {
    await service.refresh();

    expect((await query.list())[0]?.status).toBe("published");
  });

  it.each(["published", "unlisted", "withdrawn", "draft", "idea"] as const)(
    "%s も D1 と R2 に載る",
    async (status) => {
      files.set("slides/semantic-slides.md", {
        hash: `h-${status}`,
        bytes: withStatus(`status: ${status}\n`),
      });

      const result = await service.refresh();

      expect(result.processed).toEqual(["semantic-slides"]);
      expect((await query.list())[0]?.status).toBe(status);
      expect(cache.sources.has("semantic-slides")).toBe(true);
      expect(cache.mdasts.has("semantic-slides")).toBe(true);
      expect(cache.assets.has("semantic-slides/diagram.png")).toBe(true);
    },
  );

  /* status を書き換えれば原文のハッシュが変わるので、段階の移り変わりは必ず拾える。 */
  it("status を書き換えると読み直して、段階が移る", async () => {
    await service.refresh();

    files.set("slides/semantic-slides.md", {
      hash: "h-withdrawn",
      bytes: withStatus("status: withdrawn\n"),
    });
    const result = await service.refresh();

    expect(result.processed).toEqual(["semantic-slides"]);
    expect(result.deleted).toEqual([]);
    expect((await query.list())[0]?.status).toBe("withdrawn");
    // 取り下げても写しは消さない。出し直せば元に戻る。
    expect(cache.sources.has("semantic-slides")).toBe(true);
  });

  /* 下書きは「D1 に在る」うち。変更が無ければ読み直さず、消えたものとして掃除もしない。 */
  it("下書きも、変更が無ければ読み直さないし消さない", async () => {
    files.set("slides/semantic-slides.md", {
      hash: "h-draft",
      bytes: withStatus("status: draft\n"),
    });
    await service.refresh();
    content.reads.length = 0;

    const result = await service.refresh();

    expect(result.processed).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(content.reads).toEqual([]);
  });

  it("下書きでも、コンテンツリポジトリから消えれば掃除する", async () => {
    files.set("slides/semantic-slides.md", {
      hash: "h-draft",
      bytes: withStatus("status: draft\n"),
    });
    files.set("slides/another.md", { hash: "h-another", bytes: slideWith("語り。\n") });
    await service.refresh();

    files.delete("slides/semantic-slides.md");
    const result = await service.refresh();

    expect(result.deleted).toEqual(["semantic-slides"]);
  });

  /* 最後の 1 本を取り下げるときは消さずに withdrawn にする。全件削除のガードには掛からない。 */
  it("最後の 1 本も withdrawn にすれば取り下げられる", async () => {
    await service.refresh();

    files.set("slides/semantic-slides.md", {
      hash: "h-withdrawn",
      bytes: withStatus("status: withdrawn\n"),
    });

    await expect(service.refresh()).resolves.toMatchObject({ processed: ["semantic-slides"] });
  });

  /*
   * 読めない値を published に倒さない。スキップして前の姿 (前の status) を残す。
   * **投げずにスキップであること** — 投げると同期全体が落ち、ほかの種別を巻き込む。
   */
  it.each([
    ["打ち間違い", "status: pubished\n"],
    ["旧書式の visibility", "visibility: private\n"],
  ])("%s はスキップして前の姿を残す", async (_label, line) => {
    files.set("slides/semantic-slides.md", {
      hash: "h-draft",
      bytes: withStatus("status: draft\n"),
    });
    await service.refresh();

    files.set("slides/semantic-slides.md", { hash: "h-broken", bytes: withStatus(line) });
    const result = await service.refresh();

    expect(result.processed).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.path).toBe("slides/semantic-slides.md");
    expect((await query.list())[0]?.status).toBe("draft");
  });

  /* まだ同期していないスライドが読めなければ、どこにも載らない (公開しない)。 */
  it("初めての同期で status が読めなければ、載せない", async () => {
    files.set("slides/semantic-slides.md", {
      hash: "h-broken",
      bytes: withStatus("status: 公開\n"),
    });

    const result = await service.refresh();

    expect(result.skipped).toHaveLength(1);
    expect(await query.list()).toEqual([]);
    expect(cache.sources.size).toBe(0);
  });

  /* Overfull の警告は書き手に向けたもの。下書きのぶんも出す。 */
  it("下書きにも Overfull の警告を出す", async () => {
    files.set("slides/semantic-slides.md", {
      hash: "h-draft",
      bytes: bytes(
        `---\ntitle: 題\npublishedOn: 2026-11-14\nstatus: draft\n---\n\n${OVERFULL_BODY}`,
      ),
    });

    const result = await service.refresh();

    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
