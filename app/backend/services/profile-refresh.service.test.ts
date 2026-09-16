import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type { IProfileContentCache } from "~/backend/domain/profile";
import type { CachedAsset } from "~/backend/domain/shared";
import type { Nodes, Root } from "mdast";
import { beforeEach, describe, expect, it } from "vitest";
import { ProfileRefreshService } from "./profile-refresh.service";
import {
  D1ProfileCommandRepository,
  D1ProfileQueryRepository,
} from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

const PROFILE_MD = `---
name: やんてね
tagline: |
  現実に屈しかけている自由ソフトウェア愛好家です。
  東京で Web 開発者をやっています。
socials:
  - platform: github
    url: https://github.com/yantene
    isMe: true
history:
  - chapter: 高校
    entries:
      - date: 2012-03-01
        until: 2012-03-05
        text: 卒業
  - chapter: 大学
    entries:
      - date: 2012
        text: 入学
        url: https://example.com/
        note: 補足
---

長い自己紹介。

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

class InMemoryCache implements IProfileContentCache {
  source: string | undefined;
  mdast: unknown;
  readonly assets = new Map<string, CachedAsset>();
  deletedProfile = false;

  putSource(markdown: string): Promise<void> {
    this.source = markdown;
    return Promise.resolve();
  }

  getSource(): Promise<string | undefined> {
    return Promise.resolve(this.source);
  }

  putMdast(mdast: unknown): Promise<void> {
    this.mdast = mdast;
    return Promise.resolve();
  }

  getMdast(): Promise<unknown> {
    return Promise.resolve(this.mdast);
  }

  putAsset(path: string, asset: CachedAsset): Promise<void> {
    this.assets.set(path, asset);
    return Promise.resolve();
  }

  getAsset(path: string): Promise<CachedAsset | undefined> {
    return Promise.resolve(this.assets.get(path));
  }

  pruneAssets(keep: ReadonlySet<string>): Promise<void> {
    for (const path of this.assets.keys()) {
      if (!keep.has(path)) this.assets.delete(path);
    }
    return Promise.resolve();
  }

  deleteProfile(): Promise<void> {
    this.deletedProfile = true;
    this.source = undefined;
    this.mdast = undefined;
    this.assets.clear();
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
let service: ProfileRefreshService;
let content: MockContentStore;
let cache: InMemoryCache;
let query: D1ProfileQueryRepository;

beforeEach(() => {
  files = new Map([
    ["profile.md", { hash: "h-md", bytes: bytes(PROFILE_MD) }],
    ["profile/diagram.png", { hash: "h-diagram", bytes: bytes("diagram") }],
    // 記事もツリーに居る。プロフィールの同期がこれを拾わないこと。
    ["articles/hello.md", { hash: "h-article", bytes: bytes("---\ntitle: x\n---\n") }],
  ]);
  const d1 = createTestD1();
  content = new MockContentStore(files);
  cache = new InMemoryCache();
  query = new D1ProfileQueryRepository(d1);
  service = new ProfileRefreshService(content, new D1ProfileCommandRepository(d1), query, cache);
});

describe("ProfileRefreshService", () => {
  it("syncs the profile into D1 and R2", async () => {
    const result = await service.refresh();

    expect(result.synced).toBe(true);
    expect(result.skipped).toEqual([]);

    const profile = await query.find();
    expect(profile?.name.toString()).toBe("やんてね");
    expect(profile?.tagline.lines()).toEqual([
      "現実に屈しかけている自由ソフトウェア愛好家です。",
      "東京で Web 開発者をやっています。",
    ]);
    expect(profile?.socials.map((social) => social.platform)).toEqual(["github"]);
    expect(profile?.socials[0]?.isMe).toBe(true);
    /*
     * 経歴は章の入れ子で書き、平らな並びで保存する。**各件に章の名前が写っている**
     * ことと、書いた順が崩れていないことを見る (畳み直すのは出す側)。
     *
     * 引くのは `find` ではなく `findHistory`。読む口を分けてある (#519)。
     */
    const history = await query.findHistory();
    expect(history.map((entry) => [entry.chapter, entry.date.toString(), entry.text])).toEqual([
      ["高校", "2012-03-01", "卒業"],
      ["大学", "2012", "入学"],
    ]);
    expect(history[0]?.until?.toString()).toBe("2012-03-05");
    /* 精度は書き手が書いたまま。年だけの行を 1 月 1 日に倒さない。 */
    expect(history[1]?.date.precision).toBe("year");
    expect(history[1]?.until).toBeUndefined();
    expect(history[1]?.url).toBe("https://example.com/");
    expect(history[1]?.note).toBe("補足");

    expect(cache.source).toBe(PROFILE_MD);
    expect(cache.assets.get("diagram.png")).toBeDefined();
  });

  /** 記事の同期と同じツリーを見るので、articles/ を拾わないことを押さえておく。 */
  it("does not read files outside profile.md and profile/", async () => {
    await service.refresh();
    expect(content.reads).toEqual(["profile.md", "profile/diagram.png"]);
  });

  /** 本文の画像は、コンテンツリポジトリの URL を出さずアセット API 経由で配る。 */
  it("resolves the body images to the asset API", async () => {
    await service.refresh();

    const [image] = collectByType(cache.mdast as Root, "image");
    expect(image).toMatchObject({ url: "/api/v1/profile/assets/diagram.png" });
  });

  it("skips reading the source when nothing changed", async () => {
    await service.refresh();
    content.reads.length = 0;

    const result = await service.refresh();
    expect(result.synced).toBe(false);
    expect(content.reads).toEqual([]);
  });

  it("reads again when the source hash changes", async () => {
    await service.refresh();
    content.reads.length = 0;

    files.set("profile.md", { hash: "h-md-2", bytes: bytes(PROFILE_MD) });
    expect((await service.refresh()).synced).toBe(true);
    expect(content.reads).toContain("profile.md");
  });

  /** アセットを差し替えただけでも合成ハッシュが変わるので読み直す。 */
  it("reads again when only an asset changed", async () => {
    await service.refresh();

    files.set("profile/diagram.png", { hash: "h-diagram-2", bytes: bytes("diagram2") });
    expect((await service.refresh()).synced).toBe(true);
  });

  it("reads again on force even when nothing changed", async () => {
    await service.refresh();
    expect((await service.refresh({ force: true })).synced).toBe(true);
  });

  it("cleans up D1 and R2 when profile.md disappears", async () => {
    await service.refresh();

    files.delete("profile.md");
    files.delete("profile/avatar.png");
    const result = await service.refresh();

    expect(result.deleted).toBe(true);
    expect(await query.find()).toBeUndefined();
    expect(cache.deletedProfile).toBe(true);
  });

  /*
   * ブランチの取り違えやコンテンツリポジトリ側の事故で何も無い応答が返ると、掃除の経路が
   * そのまま削除になる。記事の同期にも同じガードがあるが、あちらは D1 に記事が 1 件も
   * 入っていない環境では発火しないので、こちらで独立に止める。
   */
  it("refuses to clean up when the whole tree is empty", async () => {
    await service.refresh();

    files.clear();

    await expect(service.refresh()).rejects.toThrow("the content tree is empty");
    expect(await query.find()).toBeDefined();
    expect(cache.deletedProfile).toBe(false);
  });

  it("does nothing when there is no profile and none was stored", async () => {
    files.delete("profile.md");
    files.delete("profile/diagram.png");

    const result = await service.refresh();
    expect(result).toEqual({ synced: false, deleted: false, skipped: [], linkedUrls: [] });
    expect(cache.deletedProfile).toBe(false);
  });

  it("drops assets that are no longer in the content repository", async () => {
    await service.refresh();

    files.delete("profile/diagram.png");
    files.set("profile.md", {
      hash: "h-md-2",
      bytes: bytes(PROFILE_MD.replace("![図](./diagram.png)", "")),
    });
    await service.refresh();
    expect(cache.assets.has("diagram.png")).toBe(false);
  });

  it("collects bare link URLs from the body for link cards", async () => {
    files.set("profile.md", {
      hash: "h-md-linked",
      bytes: bytes(`${PROFILE_MD}\nhttps://example.com/\n`),
    });
    expect((await service.refresh()).linkedUrls).toContain("https://example.com/");
  });
});

describe("読めないプロフィール", () => {
  /*
   * 誤字 1 つで、出ているプロフィールと記事末尾の筆者紹介が消えては困る。読めなかった
   * ときは前回の姿をそのまま残し、理由だけを返す。
   */
  it.each([
    ["名前が無い", "---\ntagline: あいさつ\n---\n"],
    ["短い自己紹介が無い", "---\nname: やんてね\n---\n"],
    [
      "知らない platform",
      "---\nname: やんてね\ntagline: あいさつ\nsocials:\n  - platform: myspace\n    url: https://example.com/\n---\n",
    ],
    /*
     * 経歴の書き損じ。**引用符付きの年をとくに見る。** YAML は `year: "2012"` を
     * 文字列として渡してくるので、通してしまうと「引用符を付けた年だけ静かに落ちる」
     * ことになる。
     */
    [
      "章の名前が無い",
      "---\nname: やんてね\ntagline: あいさつ\nhistory:\n  - entries:\n      - date: 2012\n        text: 卒業\n---\n",
    ],
    [
      "出来事が 1 件も無い章",
      "---\nname: やんてね\ntagline: あいさつ\nhistory:\n  - chapter: 高校\n    entries: []\n---\n",
    ],
    [
      "日が無い",
      "---\nname: やんてね\ntagline: あいさつ\nhistory:\n  - chapter: 高校\n    entries:\n      - text: 卒業\n---\n",
    ],
    /*
     * ⚠️ **桁を埋めない書き方をとくに見る。** 書かれた字を解釈し始めると、`2011 年ごろ`
     * のような字も «たぶん 2011» として通ってしまう。
     */
    [
      "桁を埋めていない日",
      "---\nname: やんてね\ntagline: あいさつ\nhistory:\n  - chapter: 高校\n    entries:\n      - date: 2012-3-1\n        text: 卒業\n---\n",
    ],
    [
      "暦に無い日",
      "---\nname: やんてね\ntagline: あいさつ\nhistory:\n  - chapter: 高校\n    entries:\n      - date: 2011-02-29\n        text: 卒業\n---\n",
    ],
    [
      "始まりと精度の違う終わり",
      "---\nname: やんてね\ntagline: あいさつ\nhistory:\n  - chapter: 高校\n    entries:\n      - date: 2012-02-20\n        until: 2012-02\n        text: 合宿\n---\n",
    ],
    [
      "始まりより前の終わり",
      "---\nname: やんてね\ntagline: あいさつ\nhistory:\n  - chapter: 高校\n    entries:\n      - date: 2012-02-20\n        until: 2012-02-19\n        text: 合宿\n---\n",
    ],
    [
      "出来事の字が無い",
      "---\nname: やんてね\ntagline: あいさつ\nhistory:\n  - chapter: 高校\n    entries:\n      - date: 2012\n---\n",
    ],
    [
      "http(s) でない行き先",
      "---\nname: やんてね\ntagline: あいさつ\nhistory:\n  - chapter: 高校\n    entries:\n      - date: 2012\n        text: 卒業\n        url: javascript:alert(1)\n---\n",
    ],
  ])("%s のときはスキップして前の姿を残す", async (_label, markdown) => {
    await service.refresh();

    files.set("profile.md", { hash: "h-broken", bytes: bytes(markdown) });
    const result = await service.refresh();

    expect(result.synced).toBe(false);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.path).toBe("profile.md");
    expect((await query.find())?.name.toString()).toBe("やんてね");
  });

  /** 直したら次の refresh で拾われること (壊れた版でハッシュを進めていない)。 */
  it("picks the profile up again once the writer fixes it", async () => {
    await service.refresh();

    files.set("profile.md", { hash: "h-broken", bytes: bytes("---\nname: やんてね\n---\n") });
    await service.refresh();

    files.set("profile.md", {
      hash: "h-fixed",
      bytes: bytes(PROFILE_MD.replace("name: やんてね", "name: やんてね (改)")),
    });
    expect((await service.refresh()).synced).toBe(true);
    expect((await query.find())?.name.toString()).toBe("やんてね (改)");
  });

  /** ツリーに在るのに読めないのは infra 障害。スキップに落とさず送出する (fail-loud)。 */
  it("propagates infra errors instead of skipping them", async () => {
    content.unreadable.add("profile.md");
    await expect(service.refresh()).rejects.toThrow("source file could not be read");
  });
});
