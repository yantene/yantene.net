import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkCardsRefreshService } from "./link-cards-refresh.service";
import type {
  FetchedLinkCard,
  ILinkCardAssetCache,
  ILinkCardCommandRepository,
  ILinkCardFetcher,
  ILinkCardQueryRepository,
  LinkCard,
  LinkCardAsset,
  LinkCardUrl,
  StaleLinkCardQuery,
} from "~/backend/domain/link-card";
import type { ILogger } from "~/backend/domain/shared";

const now = Temporal.Instant.from("2026-02-01T00:00:00Z");

function silentLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

const pngAsset: LinkCardAsset = {
  bytes: new Uint8Array([1]),
  contentType: "image/png",
};

function fetchedCard(
  overrides: Partial<FetchedLinkCard> = {},
): FetchedLinkCard {
  return {
    title: "題",
    description: "説明",
    siteName: "サイト",
    image: { state: "stored", asset: pngAsset },
    favicon: undefined,
    ...overrides,
  };
}

/** 保存されたカードを覚えておくだけのリポジトリ。 */
class FakeRepository
  implements ILinkCardCommandRepository, ILinkCardQueryRepository
{
  readonly stored = new Map<string, LinkCard>();
  stale: LinkCard[] = [];
  readonly staleQueries: StaleLinkCardQuery[] = [];

  upsert(card: LinkCard): Promise<void> {
    this.stored.set(card.url.toString(), card);
    return Promise.resolve();
  }

  findByUrls(urls: readonly LinkCardUrl[]): Promise<readonly LinkCard[]> {
    const found = urls
      .map((url) => this.stored.get(url.toString()))
      .filter((card): card is LinkCard => card !== undefined);
    return Promise.resolve(found);
  }

  listStale(query: StaleLinkCardQuery): Promise<readonly LinkCard[]> {
    this.staleQueries.push(query);
    return Promise.resolve(this.stale.slice(0, query.limit));
  }
}

class FakeAssetCache implements ILinkCardAssetCache {
  readonly images = new Map<string, LinkCardAsset>();
  readonly favicons = new Map<string, LinkCardAsset>();
  readonly deleted: string[] = [];

  putImage(id: string, asset: LinkCardAsset): Promise<void> {
    this.images.set(id, asset);
    return Promise.resolve();
  }

  putFavicon(id: string, asset: LinkCardAsset): Promise<void> {
    this.favicons.set(id, asset);
    return Promise.resolve();
  }

  getImage(id: string): Promise<LinkCardAsset | undefined> {
    return Promise.resolve(this.images.get(id));
  }

  getFavicon(id: string): Promise<LinkCardAsset | undefined> {
    return Promise.resolve(this.favicons.get(id));
  }

  deleteAssets(id: string): Promise<void> {
    this.deleted.push(id);
    this.images.delete(id);
    this.favicons.delete(id);
    return Promise.resolve();
  }
}

describe("LinkCardsRefreshService", () => {
  let repository: FakeRepository;
  let assets: FakeAssetCache;
  let fetcher: ILinkCardFetcher & { fetch: ReturnType<typeof vi.fn> };
  let service: LinkCardsRefreshService;

  beforeEach(() => {
    repository = new FakeRepository();
    assets = new FakeAssetCache();
    fetcher = { fetch: vi.fn().mockResolvedValue(fetchedCard()) };
    service = new LinkCardsRefreshService(
      fetcher,
      repository,
      repository,
      assets,
      silentLogger(),
    );
  });

  it("未取得の URL を取りに行って保存する", async () => {
    const result = await service.sync(["https://example.com/a"], now);

    expect(result.fetched).toEqual(["https://example.com/a"]);
    expect(result.failed).toEqual([]);
    const stored = repository.stored.get("https://example.com/a");
    expect(stored?.isAvailable).toBe(true);
    expect(stored?.metadata).toMatchObject({
      title: "題",
      image: "stored",
      hasFavicon: false,
    });
  });

  it("取れた画像を写す", async () => {
    await service.sync(["https://example.com/a"], now);

    const id = repository.stored.get("https://example.com/a")?.id ?? "";
    expect(assets.images.get(id)).toEqual(pngAsset);
  });

  it("取れなければ「取れなかった」として保存する", async () => {
    fetcher.fetch.mockResolvedValue(undefined);

    const result = await service.sync(["https://example.com/a"], now);

    expect(result.fetched).toEqual([]);
    expect(result.failed).toEqual(["https://example.com/a"]);
    expect(repository.stored.get("https://example.com/a")?.isAvailable).toBe(
      false,
    );
  });

  it("取れなくても前回写した画像は残す", async () => {
    await service.sync(["https://example.com/a"], now);
    const id = repository.stored.get("https://example.com/a")?.id ?? "";
    const deletedSoFar = assets.deleted.length;
    fetcher.fetch.mockResolvedValue(undefined);

    await service.sync(["https://example.com/a"], now, { force: true });

    // 相手が一時的に落ちただけのことがある。写しを捨てても得るものは無い。
    expect(assets.deleted).toHaveLength(deletedSoFar);
    expect(assets.images.get(id)).toEqual(pngAsset);
  });

  /*
   * 一時的に取れなかっただけで、記事のカードが素のリンクへ落ちないこと。
   *
   * 同じ関数の中で絵の写しは意図して残しているのに、D1 の題と説明は消していた (#323)。
   */
  it("取れなくても前回の題と説明は残す", async () => {
    await service.sync(["https://example.com/a"], now);
    fetcher.fetch.mockResolvedValue(undefined);

    const result = await service.sync(["https://example.com/a"], now, {
      force: true,
    });

    const stored = repository.stored.get("https://example.com/a");
    expect(stored?.isAvailable).toBe(true);
    expect(stored?.metadata?.title).toBe("題");
    // 見た目は変わっていないので failed には出さない。素のリンクへ落ちたものと
    // 混ぜると、運用者が結果を見て壊れ方を見分けられない。
    expect(result.kept).toEqual(["https://example.com/a"]);
    expect(result.failed).toEqual([]);
  });

  /*
   * 持ちこたえるのは 3 日まで。上限が無いと、恒久的に死んだリンクが古い中身を永久に
   * 出し続け、force refresh でも消せなくなる (ADR 0026)。
   */
  it("失敗し続けて 3 日を越えたら中身を捨てて素のリンクに落とす", async () => {
    await service.sync(["https://example.com/a"], now);
    const id = repository.stored.get("https://example.com/a")?.id ?? "";
    fetcher.fetch.mockResolvedValue(undefined);

    // 1 回目の失敗。ここが起点になる。
    await service.sync(["https://example.com/a"], now, { force: true });
    expect(repository.stored.get("https://example.com/a")?.isAvailable).toBe(
      true,
    );

    // 起点から 3 日。もう「一時的」ではない。
    const later = now.add({ hours: 24 * 3 });
    const result = await service.sync(["https://example.com/a"], later, {
      force: true,
    });

    const stored = repository.stored.get("https://example.com/a");
    expect(stored?.isAvailable).toBe(false);
    expect(result.kept).toEqual([]);
    expect(result.failed).toEqual(["https://example.com/a"]);
    // 誰も参照しなくなった写しを R2 に残さない。
    expect(assets.deleted).toContain(id);
    expect(assets.images.get(id)).toBeUndefined();
  });

  it("持ちこたえている間に取れたら上限は測り直しになる", async () => {
    await service.sync(["https://example.com/a"], now);
    fetcher.fetch.mockResolvedValue(undefined);
    await service.sync(["https://example.com/a"], now, { force: true });

    // 2 日後に復帰。
    fetcher.fetch.mockResolvedValue(fetchedCard());
    const recovered = now.add({ hours: 48 });
    await service.sync(["https://example.com/a"], recovered, { force: true });
    expect(
      repository.stored.get("https://example.com/a")?.fetchFailedSince,
    ).toBeUndefined();

    // さらに 2 日後にまた落ちた。最初の失敗から通算 4 日だが、起点は復帰後に移っている。
    fetcher.fetch.mockResolvedValue(undefined);
    await service.sync(
      ["https://example.com/a"],
      recovered.add({ hours: 48 }),
      {
        force: true,
      },
    );

    expect(repository.stored.get("https://example.com/a")?.isAvailable).toBe(
      true,
    );
  });

  /*
   * 残した行は「直近の取得は失敗した」印を持つ。見せているのは古い中身なので、
   * 14 日ではなく短い側の間隔で確かめ直す。
   */
  it("前回の中身を残した行は短い期限で取り直す", async () => {
    await service.sync(["https://example.com/a"], now);
    fetcher.fetch.mockResolvedValue(undefined);
    await service.sync(["https://example.com/a"], now, { force: true });
    fetcher.fetch.mockClear();

    // 25 時間後。取得できたカードの期限 (14 日) には遠いが、失敗した側 (24 時間) は過ぎている。
    const later = now.add({ hours: 25 });
    await service.sync(["https://example.com/a"], later);

    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it("期限内のカードは取りに行かない", async () => {
    await service.sync(["https://example.com/a"], now);
    fetcher.fetch.mockClear();

    const result = await service.sync(
      ["https://example.com/a"],
      now.add({ hours: 24 }),
    );

    expect(fetcher.fetch).not.toHaveBeenCalled();
    expect(result.fetched).toEqual([]);
  });

  it("期限切れのカードは取り直す", async () => {
    await service.sync(["https://example.com/a"], now);
    fetcher.fetch.mockClear();

    const later = now.add({ hours: 24 * 15 });
    const result = await service.sync(["https://example.com/a"], later);

    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    expect(result.fetched).toEqual(["https://example.com/a"]);
  });

  it("force なら期限内でも取り直す", async () => {
    await service.sync(["https://example.com/a"], now);
    fetcher.fetch.mockClear();

    await service.sync(["https://example.com/a"], now, { force: true });

    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it("参照されていない期限切れのカードも洗い替える", async () => {
    await service.sync(["https://example.com/old"], now);
    const old = repository.stored.get("https://example.com/old");
    expect(old).toBeDefined();
    repository.stale = old === undefined ? [] : [old];
    fetcher.fetch.mockClear();

    // 今回の記事はこの URL に触れていないが、期限切れなので拾われる。
    const result = await service.sync([], now.add({ hours: 24 * 15 }));

    expect(result.fetched).toEqual(["https://example.com/old"]);
  });

  it("期限の境目はドメインの決めたものを渡す", async () => {
    await service.sync([], now);

    expect(repository.staleQueries[0]?.available.toString()).toBe(
      "2026-01-18T00:00:00Z",
    );
    expect(repository.staleQueries[0]?.unavailable.toString()).toBe(
      "2026-01-31T00:00:00Z",
    );
    expect(repository.staleQueries[0]?.imageMissed.toString()).toBe(
      "2026-01-31T00:00:00Z",
    );
  });

  it("取り直す前に前回の画像を捨てる", async () => {
    await service.sync(["https://example.com/a"], now);
    const id = repository.stored.get("https://example.com/a")?.id ?? "";

    fetcher.fetch.mockResolvedValue(
      fetchedCard({ image: { state: "absent" } }),
    );
    await service.sync(["https://example.com/a"], now, { force: true });

    expect(assets.deleted).toContain(id);
    expect(assets.images.has(id)).toBe(false);
    expect(
      repository.stored.get("https://example.com/a")?.metadata?.image,
    ).toBe("absent");
  });

  it("絵を取り逃したカードは短い期限で取り直す", async () => {
    fetcher.fetch.mockResolvedValue(
      fetchedCard({ image: { state: "missed" } }),
    );
    await service.sync(["https://example.com/a"], now);
    fetcher.fetch.mockClear();

    // 題が取れているので「取得できた」の側だが、14 日は待たない。
    const result = await service.sync(
      ["https://example.com/a"],
      now.add({ hours: 24 }),
    );

    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    expect(result.fetched).toEqual(["https://example.com/a"]);
  });

  it("絵を持たない相手のカードは期限内なら取りに行かない", async () => {
    fetcher.fetch.mockResolvedValue(
      fetchedCard({ image: { state: "absent" } }),
    );
    await service.sync(["https://example.com/a"], now);
    fetcher.fetch.mockClear();

    await service.sync(["https://example.com/a"], now.add({ hours: 24 }));

    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it("同じ URL が何度出てきても 1 回しか取りに行かない", async () => {
    await service.sync(["https://example.com/a", "https://example.com/a"], now);

    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it("カードにできない URL は黙って飛ばす", async () => {
    const result = await service.sync(
      ["not a url", "mailto:a@example.com"],
      now,
    );

    expect(fetcher.fetch).not.toHaveBeenCalled();
    expect(result.fetched).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("1 回の上限を超えた分は見送り、件数を報告する", async () => {
    const urls = Array.from(
      { length: 45 },
      (_, index) => `https://example.com/${String(index)}`,
    );

    const result = await service.sync(urls, now);

    expect(result.fetched).toHaveLength(40);
    expect(result.deferred).toBe(5);
    expect(fetcher.fetch).toHaveBeenCalledTimes(40);
  });
});
