import { describe, expect, it } from "vitest";
import { NotesRefreshService } from "./notes-refresh.service";
import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type { CachedAsset, INoteContentCache } from "~/backend/domain/note";
import { NoteSlug } from "~/backend/domain/note";
import {
  Webmention,
  WebmentionAuthor,
  WebmentionType,
  WebmentionUrl,
} from "~/backend/domain/webmention";
import {
  D1NoteCommandRepository,
  D1NoteQueryRepository,
  D1NoteSearchIndex,
  D1WebmentionCommandRepository,
  D1WebmentionQueryRepository,
} from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

class MockContentStore implements IContentStore {
  /** readFile に渡されたパス。1 ノートを何度読んだかを見るために控える。 */
  readonly reads: string[] = [];

  constructor(
    private readonly files: Map<string, { hash: string; bytes: Uint8Array }>,
  ) {}

  listTree(): Promise<readonly ContentEntry[]> {
    return Promise.resolve(
      [...this.files].map(([path, { hash }]) => ({ path, hash })),
    );
  }

  readFile(path: string): Promise<Uint8Array | undefined> {
    this.reads.push(path);
    return Promise.resolve(this.files.get(path)?.bytes);
  }
}

class InMemoryCache implements INoteContentCache {
  readonly sources = new Map<string, string>();
  readonly mdasts = new Map<string, unknown>();
  readonly assets = new Map<string, CachedAsset>();

  putSource(slug: NoteSlug, markdown: string): Promise<void> {
    this.sources.set(slug.toString(), markdown);
    return Promise.resolve();
  }
  getSource(slug: NoteSlug): Promise<string | undefined> {
    return Promise.resolve(this.sources.get(slug.toString()));
  }
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
    this.sources.delete(slug.toString());
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

/** 寸法だけ読める最小の PNG (シグネチャ + IHDR)。 */
function pngBytes(width: number, height: number): Uint8Array {
  const png = new Uint8Array(24);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(png.buffer);
  view.setUint32(8, 13);
  png.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  view.setUint32(16, width);
  view.setUint32(20, height);
  return png;
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
  content: MockContentStore;
  /** Webmention など、同期の巻き添えを見るために同じ DB を触る用。 */
  d1: D1Database;
} {
  const d1 = createTestD1();
  const command = new D1NoteCommandRepository(d1);
  const query = new D1NoteQueryRepository(d1);
  const cache = new InMemoryCache();
  const searchIndex = new D1NoteSearchIndex(d1);
  const content = new MockContentStore(files);
  const service = new NotesRefreshService(
    content,
    command,
    query,
    cache,
    searchIndex,
  );
  return { service, command, query, cache, content, d1 };
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

  /*
   * 画像として貼れないアセット (曲の MIDI など) へ、本文からリンクを張れるようにしてある
   * (ADR 0022)。書き換わるのは相対パスだけで、外部リンクと記事間リンクには触らない。
   */
  it("resolves relative link URLs and leaves absolute ones alone", async () => {
    const linksMd = `---
title: Links
publishedOn: 2026-01-15
lastModifiedOn: 2026-01-15
---

[原本](./song.mid) と [外](https://example.com/song.mid) と [他の記事](/notes/other)。
`;
    const files = new Map([
      ["notes/links.md", { hash: "h1", bytes: bytes(linksMd) }],
      ["notes/links/song.mid", { hash: "a1", bytes: bytes("MThd") }],
    ]);
    const { service, cache } = setup(files);

    await service.refresh();

    const mdastJson = JSON.stringify(cache.mdasts.get("links"));
    expect(mdastJson).toContain("/api/v1/notes/links/assets/song.mid");
    // 外部リンクとルート相対はそのまま (アセット配下へ押し込まれない)。
    expect(mdastJson).toContain("https://example.com/song.mid");
    expect(mdastJson).not.toContain("assets/notes/other");
    expect(mdastJson).toContain("/notes/other");
  });

  /*
   * `/notes/<slug>.md` の配信元になる原文を R2 に置く。MDAST と違い、
   * フロントマターも画像の相対パスも書き換えず正本そのままを保つ。
   */
  it("caches the source markdown verbatim", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
      ["notes/hello/cover.png", { hash: "a1", bytes: bytes("PNG") }],
      ["notes/hello/inline.png", { hash: "a2", bytes: bytes("PNG2") }],
    ]);
    const { service, cache } = setup(files);

    await service.refresh();

    expect(cache.sources.get("hello")).toBe(helloMd);
  });

  it("drops the cached source when the note disappears from the content store", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
      // ツリーが空になると全件削除の安全弁に掛かるので、無関係のノートを 1 本残す。
      ["notes/other.md", { hash: "o1", bytes: bytes(helloMd) }],
    ]);
    const { service, cache } = setup(files);
    await service.refresh();
    expect(cache.sources.has("hello")).toBe(true);

    files.delete("notes/hello.md");
    const result = await service.refresh();

    expect(result.deleted).toEqual(["hello"]);
    expect(cache.sources.has("hello")).toBe(false);
  });

  /*
   * 画像の width/height は refresh 時に MDAST へ埋める (レイアウトシフト対策)。
   * 寸法を読めない画像には何も付けないことも併せて固定する。
   */
  it("embeds image dimensions into the cached MDAST", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
      ["notes/hello/cover.png", { hash: "a1", bytes: pngBytes(1200, 630) }],
      ["notes/hello/inline.png", { hash: "a2", bytes: pngBytes(800, 450) }],
    ]);
    const { service, cache } = setup(files);

    await service.refresh();

    const mdast = cache.mdasts.get("hello") as {
      children: { type: string; children?: unknown[] }[];
    };
    const images: { url?: string; data?: { hProperties?: unknown } }[] = [];
    const walk = (node: unknown): void => {
      if (typeof node !== "object" || node === null) return;
      const record = node as {
        type?: string;
        url?: string;
        data?: { hProperties?: unknown };
        children?: unknown[];
      };
      if (record.type === "image") images.push(record);
      const children = record.children ?? [];
      for (const child of children) walk(child);
    };
    walk(mdast);

    expect(images).toHaveLength(1);
    expect(images[0].url).toBe("/api/v1/notes/hello/assets/inline.png");
    expect(images[0].data?.hProperties).toEqual({ width: 800, height: 450 });
  });

  /*
   * 変更検出は md + アセットのハッシュなので、実装変更 (MDAST の作り方を変えた等) は
   * 通常の refresh では既存ノートに反映されない。force はそれを流すための逃げ道。
   */
  it("reprocesses unchanged notes when force is given", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
      ["notes/hello/cover.png", { hash: "a1", bytes: pngBytes(1200, 630) }],
      ["notes/hello/inline.png", { hash: "a2", bytes: pngBytes(800, 450) }],
    ]);
    const { service } = setup(files);

    await service.refresh();
    // 2 回目: ハッシュが同じなのでスキップされる
    const second = await service.refresh();
    expect(second.processed).toEqual([]);
    // force ならスキップせず再処理する
    const forced = await service.refresh({ force: true });
    expect(forced.processed).toEqual(["hello"]);
  });

  it("leaves images without readable dimensions untouched", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
      ["notes/hello/cover.png", { hash: "a1", bytes: bytes("PNG") }],
      // 寸法を判別できないダミーバイト列
      ["notes/hello/inline.png", { hash: "a2", bytes: bytes("not an image") }],
    ]);
    const { service, cache } = setup(files);

    await service.refresh();

    const mdastJson = JSON.stringify(cache.mdasts.get("hello"));
    expect(mdastJson).toContain("/api/v1/notes/hello/assets/inline.png");
    expect(mdastJson).not.toContain("hProperties");
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
      // ツリーが空になると全件削除の安全弁に掛かるので、無関係のノートを 1 本残す。
      ["notes/other.md", { hash: "o1", bytes: bytes(helloMd) }],
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

  /*
   * 数式は refresh のときに MathML へ組む。読めない LaTeX があったら、そのノードだけを
   * 落として理由を返す (refresh 全体を落とすと他のノートまで同期されない)。
   */
  it("skips notes whose LaTeX cannot be parsed", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }] as const,
      [
        "notes/bad-math.md",
        {
          hash: "m1",
          bytes: bytes(
            "---\ntitle: Bad math\npublishedOn: 2026-01-15\n---\n\n式 $\\frac{$ です。\n",
          ),
        },
      ] as const,
    ]);
    const { service, query } = setup(new Map(files));

    const result = await service.refresh();
    expect(result.processed).toEqual(["hello"]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].path).toBe("notes/bad-math.md");
    expect(await query.findBySlug(NoteSlug.create("bad-math"))).toBeUndefined();
  });

  it("caches the MathML built from the LaTeX in the note body", async () => {
    const files = new Map([
      [
        "notes/hello.md",
        {
          hash: "h1",
          bytes: bytes(
            "---\ntitle: Math\npublishedOn: 2026-01-15\n---\n\n式 $a^2$ です。\n",
          ),
        },
      ],
    ]);
    const { service, cache } = setup(files);

    await service.refresh();
    const mdastJson = JSON.stringify(cache.mdasts.get("hello"));
    expect(mdastJson).toContain("http://www.w3.org/1998/Math/MathML");
    expect(mdastJson).toContain("msup");
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

describe("visibility", () => {
  const withVisibility = (value: string): string =>
    `---\ntitle: Secret\npublishedOn: 2026-01-15\nvisibility: ${value}\n---\n\n人に見せたくない話。\n`;

  it("private の記事は同期しない", async () => {
    const files = new Map([
      [
        "notes/secret.md",
        { hash: "s1", bytes: bytes(withVisibility("private")) },
      ],
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
    ]);
    const { service, query, cache } = setup(files);

    const result = await service.refresh();
    expect(result.processed).toEqual(["hello"]);
    expect(result.unpublished).toEqual(["secret"]);

    expect(await query.findBySlug(NoteSlug.create("secret"))).toBeUndefined();
    expect(cache.sources.has("secret")).toBe(false);
    expect(cache.mdasts.has("secret")).toBe(false);
  });

  it("公開済みの記事を private にすると D1 と R2 から消える", async () => {
    const files = new Map([
      [
        "notes/secret.md",
        {
          hash: "s1",
          bytes: bytes(
            "---\ntitle: Secret\npublishedOn: 2026-01-15\n---\n\n本文。\n",
          ),
        },
      ],
    ]);
    const { service, query, cache } = setup(files);

    await service.refresh();
    expect(await query.findBySlug(NoteSlug.create("secret"))).toBeDefined();
    expect(cache.sources.has("secret")).toBe(true);

    // 同じ slug を private にして再度 refresh
    files.set("notes/secret.md", {
      hash: "s2",
      bytes: bytes(withVisibility("private")),
    });
    const result = await service.refresh();

    expect(result.unpublished).toEqual(["secret"]);
    expect(result.deleted).toEqual(["secret"]);
    expect(await query.findBySlug(NoteSlug.create("secret"))).toBeUndefined();
    expect(cache.sources.has("secret")).toBe(false);
  });

  it("visibility を書かなければ公開する", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
    ]);
    const { service, query } = setup(files);

    const result = await service.refresh();
    expect(result.unpublished).toEqual([]);
    expect(await query.findBySlug(NoteSlug.create("hello"))).toBeDefined();
  });

  it("public を明示した記事は公開する", async () => {
    const files = new Map([
      [
        "notes/secret.md",
        { hash: "s1", bytes: bytes(withVisibility("public")) },
      ],
    ]);
    const { service, query } = setup(files);

    const result = await service.refresh();
    expect(result.processed).toEqual(["secret"]);
    expect(await query.findBySlug(NoteSlug.create("secret"))).toBeDefined();
  });

  it("読めない値は公開せず、綴りの誤りとして報告する", async () => {
    const files = new Map([
      [
        "notes/secret.md",
        { hash: "s1", bytes: bytes(withVisibility("prvate")) },
      ],
    ]);
    const { service, query } = setup(files);

    const result = await service.refresh();
    // 隠すと決めた記事ではないので unpublished には数えない。
    expect(result.unpublished).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.path).toBe("notes/secret.md");
    expect(result.skipped[0]?.reason).toContain("visibility");
    expect(await query.findBySlug(NoteSlug.create("secret"))).toBeUndefined();
  });

  /*
   * 綴りの誤りは「隠すと決めた意思」ではないので、公開済みの記事を取り下げる理由にも
   * ならない。書き直すまで前回の内容を出し続ける。
   */
  it("公開済みの記事の visibility が読めなくなっても消さない", async () => {
    const files = new Map([
      [
        "notes/secret.md",
        {
          hash: "s1",
          bytes: bytes(
            "---\ntitle: Secret\npublishedOn: 2026-01-15\n---\n\n本文。\n",
          ),
        },
      ],
    ]);
    const { service, query, cache } = setup(files);

    await service.refresh();
    files.set("notes/secret.md", {
      hash: "s2",
      bytes: bytes(withVisibility("prvate")),
    });
    const result = await service.refresh();

    expect(result.skipped).toHaveLength(1);
    expect(result.deleted).toEqual([]);
    expect(await query.findBySlug(NoteSlug.create("secret"))).toBeDefined();
    expect(cache.sources.has("secret")).toBe(true);
  });

  it("大文字や前後の空白を許す", async () => {
    const files = new Map([
      [
        "notes/secret.md",
        { hash: "s1", bytes: bytes(withVisibility('"  PRIVATE  "')) },
      ],
    ]);
    const { service } = setup(files);

    const result = await service.refresh();
    expect(result.unpublished).toEqual(["secret"]);
  });

  it("公開範囲を見るために原文を読み直さない", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
      ["notes/hello/cover.png", { hash: "a1", bytes: bytes("PNG") }],
      ["notes/hello/inline.png", { hash: "a2", bytes: bytes("PNG2") }],
    ]);
    const { service, content } = setup(files);

    await service.refresh();

    expect(content.reads.filter((path) => path === "notes/hello.md")).toEqual([
      "notes/hello.md",
    ]);
  });

  it("変更のない記事は原文を開かない", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
      ["notes/hello/cover.png", { hash: "a1", bytes: bytes("PNG") }],
      ["notes/hello/inline.png", { hash: "a2", bytes: bytes("PNG2") }],
    ]);
    const { service, content, query } = setup(files);

    await service.refresh();
    const readsAfterFirst = content.reads.length;
    const result = await service.refresh();

    expect(result.processed).toEqual([]);
    expect(content.reads).toHaveLength(readsAfterFirst);
    // 読まなかったノートを「正本から消えた」と誤認して掃除していないこと。
    expect(result.deleted).toEqual([]);
    expect(await query.findBySlug(NoteSlug.create("hello"))).toBeDefined();
  });
});

/*
 * コンテンツ不正 (読めない LaTeX / 読めない visibility) はそのノートを飛ばすだけで、
 * 前回同期した内容には手を付けない。スキップしたノートを掃除の対象に残していたころは、
 * 書き手の誤字 1 つで公開中の記事が 404 になり、閲覧数も届いた Webmention も
 * 巻き添えで消えていた ([#250](https://github.com/yantene/yantene.net/issues/250))。
 */
describe("コンテンツ不正でスキップしたノート", () => {
  /** 公開に必要なフロントマターは揃っていて、本文の LaTeX だけが読めない。 */
  const brokenMathMd = String.raw`---
title: Broken
publishedOn: 2026-01-15
---

式 $\frac{$ です。
`;

  it("公開済みの本文を壊しても、D1 と R2 の旧版を残す", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
    ]);
    const { service, query, cache } = setup(files);

    await service.refresh();
    files.set("notes/hello.md", { hash: "h2", bytes: bytes(brokenMathMd) });
    const result = await service.refresh();

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].path).toBe("notes/hello.md");
    expect(result.processed).toEqual([]);
    // 正本には在るのだから、消えたノートとして掃除してはいけない。
    expect(result.deleted).toEqual([]);

    const note = await query.findBySlug(NoteSlug.create("hello"));
    expect(note?.title.toString()).toBe("Hello");
    // 原文と MDAST も前回同期したまま。記事は読めるままになる。
    expect(cache.sources.get("hello")).toBe(helloMd);
    expect(cache.mdasts.has("hello")).toBe(true);
  });

  it("公開済みの本文を壊しても、届いた Webmention を消さない", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
    ]);
    const { service, query, d1 } = setup(files);

    await service.refresh();
    const note = await query.findBySlug(NoteSlug.create("hello"));
    if (note === undefined) throw new Error("1 回目の同期で載っていること");

    // 記事に反応が 1 件届いた状態を作る。
    await new D1WebmentionCommandRepository(d1).upsert(
      Webmention.create({
        noteId: note.id,
        target: note.slug,
        source: WebmentionUrl.create("https://example.com/post/1"),
        type: WebmentionType.reply(),
        author: WebmentionAuthor.create({ name: "Alice" }),
      }),
    );

    files.set("notes/hello.md", { hash: "h2", bytes: bytes(brokenMathMd) });
    await service.refresh();

    // ノートの行を消すと Webmention も一緒に消える。正本のどこにも無いので戻せない。
    const stored = await new D1WebmentionQueryRepository(d1).listByNoteId(
      note.id,
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].source.toString()).toBe("https://example.com/post/1");
  });
});

/*
 * 掃除の経路は「正本から消えた 1 本」を消すためのもので、「正本が空に見える」を
 * 全件削除の合図として受け取らない。ブランチの取り違えや正本側の事故で notes/ を
 * 持たない応答が返ったとき、被害はコンテンツ不正のときと同じになる。
 */
describe("空のツリー", () => {
  it("1 件も見つからないときは全件削除せず送出する", async () => {
    const files = new Map([
      ["notes/hello.md", { hash: "h1", bytes: bytes(helloMd) }],
    ]);
    const { service, query, cache } = setup(files);

    await service.refresh();
    files.clear();

    await expect(service.refresh()).rejects.toThrow(/refusing to delete/);
    expect(await query.findBySlug(NoteSlug.create("hello"))).toBeDefined();
    expect(cache.sources.has("hello")).toBe(true);
  });

  it("まだ 1 件も載っていなければ空のツリーを受け入れる", async () => {
    const { service } = setup(new Map());

    const result = await service.refresh();

    expect(result.processed).toEqual([]);
    expect(result.deleted).toEqual([]);
  });
});
