import { describe, expect, it } from "vitest";
import { ProfileRefreshService } from "./profile-refresh.service";
import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type { IProfileContentCache } from "~/backend/domain/profile";
import {
  D1ProfileCommandRepository,
  D1ProfileQueryRepository,
} from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

/** ツリーに載る 1 ファイル。`bytes` を省くと「ツリーには在るのに読めない」を表す。 */
interface ContentFile {
  readonly hash: string;
  readonly bytes?: Uint8Array;
}

class MockContentStore implements IContentStore {
  /** readFile に渡されたパス。読み直した回数を見るために控える。 */
  readonly reads: string[] = [];

  constructor(private readonly files: Map<string, ContentFile>) {}

  listTree(): Promise<readonly ContentEntry[]> {
    return Promise.resolve([...this.files].map(([path, { hash }]) => ({ path, hash })));
  }

  readFile(path: string): Promise<Uint8Array | undefined> {
    this.reads.push(path);
    return Promise.resolve(this.files.get(path)?.bytes);
  }
}

class InMemoryCache implements IProfileContentCache {
  mdast: unknown;

  putMdast(mdast: unknown): Promise<void> {
    this.mdast = mdast;
    return Promise.resolve();
  }
  getMdast(): Promise<unknown> {
    return Promise.resolve(this.mdast);
  }
  delete(): Promise<void> {
    this.mdast = undefined;
    return Promise.resolve();
  }
}

const PROFILE = `---
name: 吉田 周平 (Shuhei YOSHIDA)
dateOfBirth: 1993-11-18
birthplace: 愛知県刈谷市
tagline: |
  一介のコンピュータ好き。
  東京で Web 開発をしている。
socials:
  - platform: github
    url: https://github.com/yantene
    isMe: true
  - platform: discord
    url: https://discord.com/users/yantene
    isMe: false
---

## Favorites

やっぱり昔から一貫してコンピュータが好きだ。
`;

function file(markdown: string, hash = "h1"): Map<string, ContentFile> {
  return new Map([["profile.md", { hash, bytes: new TextEncoder().encode(markdown) }]]);
}

interface Harness {
  readonly content: MockContentStore;
  readonly query: D1ProfileQueryRepository;
  readonly cache: InMemoryCache;
  readonly service: ProfileRefreshService;
}

function setup(files: Map<string, ContentFile>): Harness {
  const d1 = createTestD1();
  const content = new MockContentStore(files);
  const command = new D1ProfileCommandRepository(d1);
  const query = new D1ProfileQueryRepository(d1);
  const cache = new InMemoryCache();
  return {
    content,
    query,
    cache,
    service: new ProfileRefreshService(content, command, query, cache),
  };
}

describe("ProfileRefreshService", () => {
  it("フロントマターを D1 に、本文を R2 に置く", async () => {
    const { service, query, cache } = setup(file(PROFILE));

    const result = await service.refresh();

    expect(result).toEqual({ processed: true, deleted: false, skipped: undefined });

    const profile = await query.find();
    expect(profile?.name.toString()).toBe("吉田 周平 (Shuhei YOSHIDA)");
    expect(profile?.dateOfBirth.toString()).toBe("1993-11-18");
    expect(profile?.birthplace).toBe("愛知県刈谷市");
    expect(profile?.tagline).toBe("一介のコンピュータ好き。\n東京で Web 開発をしている。");
    expect(profile?.socials).toEqual([
      { platform: "github", url: "https://github.com/yantene", isMe: true },
      { platform: "discord", url: "https://discord.com/users/yantene", isMe: false },
    ]);

    // 本文だけが MDAST になる (フロントマターは載らない)。
    expect(JSON.stringify(cache.mdast)).toContain("Favorites");
    expect(JSON.stringify(cache.mdast)).not.toContain("dateOfBirth");
  });

  it("ハッシュが同じなら読み直さない", async () => {
    const { service, content } = setup(file(PROFILE));

    await service.refresh();
    await service.refresh();

    expect(content.reads).toEqual(["profile.md"]);
  });

  it("force なら中身が同じでも読み直す", async () => {
    const { service, content } = setup(file(PROFILE));

    await service.refresh();
    const result = await service.refresh({ force: true });

    expect(result.processed).toBe(true);
    expect(content.reads).toEqual(["profile.md", "profile.md"]);
  });

  it("ハッシュが変われば読み直す", async () => {
    const files = file(PROFILE);
    const { service, query } = setup(files);
    await service.refresh();

    files.set("profile.md", {
      hash: "h2",
      bytes: new TextEncoder().encode(PROFILE.replace("愛知県刈谷市", "愛知県")),
    });
    const result = await service.refresh();

    expect(result.processed).toBe(true);
    expect((await query.find())?.birthplace).toBe("愛知県");
  });

  it("profile.md が消えたら D1 と R2 から掃除する", async () => {
    const files = file(PROFILE);
    const { service, query, cache } = setup(files);
    await service.refresh();

    files.delete("profile.md");
    const result = await service.refresh();

    expect(result).toEqual({ processed: false, deleted: true, skipped: undefined });
    expect(await query.find()).toBeUndefined();
    expect(cache.mdast).toBeUndefined();
  });

  it("一度も同期していない状態で profile.md が無くても、消したことにはしない", async () => {
    const { service } = setup(new Map());

    expect(await service.refresh()).toEqual({
      processed: false,
      deleted: false,
      skipped: undefined,
    });
  });

  describe("読めないフロントマター", () => {
    it.each([
      ["name が無い", PROFILE.replace("name: 吉田 周平 (Shuhei YOSHIDA)\n", ""), /name/],
      ["tagline が無い", PROFILE.replace(/tagline: \|\n(  .*\n)+/, ""), /tagline/],
      ["dateOfBirth が無い", PROFILE.replace("dateOfBirth: 1993-11-18\n", ""), /dateOfBirth/],
      ["日付の粒度が粗い", PROFILE.replace("1993-11-18", "1993-11"), /dateOfBirth/],
      ["在り得ない日付", PROFILE.replace("1993-11-18", "1993-13-45"), /dateOfBirth/],
      ["知らない platform", PROFILE.replace("platform: github", "platform: linkedin"), /platform/],
      ["url が無い", PROFILE.replace("    url: https://github.com/yantene\n", ""), /url/],
    ])("%s ときはファイルごとスキップして理由を返す", async (_label, markdown, reason) => {
      const { service, query, cache } = setup(file(markdown));

      const result = await service.refresh();

      expect(result.processed).toBe(false);
      expect(result.skipped?.path).toBe("profile.md");
      expect(result.skipped?.reason).toMatch(reason);
      // 書き込みまで進まない。
      expect(await query.find()).toBeUndefined();
      expect(cache.mdast).toBeUndefined();
    });

    it("スキップしても、前に同期した中身は残る", async () => {
      const files = file(PROFILE);
      const { service, query } = setup(files);
      await service.refresh();

      files.set("profile.md", {
        hash: "h2",
        bytes: new TextEncoder().encode(PROFILE.replace("1993-11-18", "yesterday")),
      });
      const result = await service.refresh();

      expect(result.skipped).toBeDefined();
      expect((await query.find())?.dateOfBirth.toString()).toBe("1993-11-18");
    });
  });

  it("socials を書かなければ空の並びになる", async () => {
    const { service, query } = setup(file(PROFILE.replace(/socials:\n(  .*\n|    .*\n)+/, "")));

    await service.refresh();

    expect((await query.find())?.socials).toEqual([]);
  });

  it("ツリーに在るのに読めないのは infra 障害として送出する", async () => {
    const { service } = setup(new Map([["profile.md", { hash: "h1" }]]));

    await expect(service.refresh()).rejects.toThrow(/could not be read/);
  });
});
