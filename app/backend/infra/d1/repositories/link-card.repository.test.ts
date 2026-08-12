import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it } from "vitest";
import { D1LinkCardCommandRepository } from "./link-card.command-repository";
import { D1LinkCardQueryRepository } from "./link-card.query-repository";
import { LinkCard, LinkCardUrl } from "~/backend/domain/link-card";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

const now = Temporal.Instant.from("2026-02-01T00:00:00Z");

function url(raw: string): LinkCardUrl {
  return LinkCardUrl.create(raw);
}

function availableCard(params: {
  id: string;
  raw: string;
  fetchedAt?: Temporal.Instant;
  hasImage?: boolean;
}): LinkCard {
  return LinkCard.available({
    id: params.id,
    url: url(params.raw),
    metadata: {
      title: "題",
      description: "説明",
      siteName: "サイト",
      hasImage: params.hasImage ?? true,
      hasFavicon: false,
    },
    fetchedAt: params.fetchedAt ?? now,
  });
}

describe("D1LinkCard リポジトリ", () => {
  let d1: D1Database;
  let command: D1LinkCardCommandRepository;
  let query: D1LinkCardQueryRepository;

  beforeEach(() => {
    d1 = createTestD1();
    command = new D1LinkCardCommandRepository(d1);
    query = new D1LinkCardQueryRepository(d1);
  });

  it("書いたカードを URL で引ける", async () => {
    await command.upsert(
      availableCard({ id: "a1", raw: "https://example.com/a" }),
    );

    const [found] = await query.findByUrls([url("https://example.com/a")]);
    expect(found.id).toBe("a1");
    expect(found.isAvailable).toBe(true);
    expect(found.metadata).toEqual({
      title: "題",
      description: "説明",
      siteName: "サイト",
      hasImage: true,
      hasFavicon: false,
    });
  });

  it("取得できなかったカードも保存でき、中身なしで戻る", async () => {
    await command.upsert(
      LinkCard.unavailable({
        id: "b1",
        url: url("https://example.com/b"),
        fetchedAt: now,
      }),
    );

    const [found] = await query.findByUrls([url("https://example.com/b")]);
    expect(found.isAvailable).toBe(false);
    expect(found.metadata).toBeUndefined();
    expect(found.fetchedAt.equals(now)).toBe(true);
  });

  it("同じ URL を書き直すと置き換わる", async () => {
    await command.upsert(
      availableCard({ id: "a1", raw: "https://example.com/a" }),
    );
    await command.upsert(
      LinkCard.unavailable({
        id: "a1",
        url: url("https://example.com/a"),
        fetchedAt: now.add({ hours: 1 }),
      }),
    );

    const found = await query.findByUrls([url("https://example.com/a")]);
    expect(found).toHaveLength(1);
    expect(found[0].isAvailable).toBe(false);
  });

  it("画像の有無が消えたことも上書きで反映される", async () => {
    await command.upsert(
      availableCard({ id: "a1", raw: "https://example.com/a", hasImage: true }),
    );
    await command.upsert(
      availableCard({
        id: "a1",
        raw: "https://example.com/a",
        hasImage: false,
      }),
    );

    const [found] = await query.findByUrls([url("https://example.com/a")]);
    expect(found.metadata?.hasImage).toBe(false);
  });

  it("見つからない URL は結果に現れない", async () => {
    await command.upsert(
      availableCard({ id: "a1", raw: "https://example.com/a" }),
    );

    const found = await query.findByUrls([
      url("https://example.com/a"),
      url("https://example.com/missing"),
    ]);
    expect(found.map((card) => card.url.toString())).toEqual([
      "https://example.com/a",
    ]);
  });

  it("URL を 1 つも渡さなければ問い合わせない", async () => {
    await expect(query.findByUrls([])).resolves.toEqual([]);
  });

  describe("listStale", () => {
    beforeEach(async () => {
      // 取得できている: 20 日前 (期限切れ) と 1 日前 (まだ有効)
      await command.upsert(
        availableCard({
          id: "old-ok",
          raw: "https://example.com/old-ok",
          fetchedAt: now.subtract({ hours: 24 * 20 }),
        }),
      );
      await command.upsert(
        availableCard({
          id: "fresh-ok",
          raw: "https://example.com/fresh-ok",
          fetchedAt: now.subtract({ hours: 24 }),
        }),
      );
      // 取得できなかった: 2 日前 (期限切れ) と 1 時間前 (まだ有効)
      await command.upsert(
        LinkCard.unavailable({
          id: "old-ng",
          url: url("https://example.com/old-ng"),
          fetchedAt: now.subtract({ hours: 48 }),
        }),
      );
      await command.upsert(
        LinkCard.unavailable({
          id: "fresh-ng",
          url: url("https://example.com/fresh-ng"),
          fetchedAt: now.subtract({ hours: 1 }),
        }),
      );
    });

    it("成否ごとの期限で絞り、古い順に返す", async () => {
      const stale = await query.listStale({
        available: now.subtract({ hours: 24 * 14 }),
        unavailable: now.subtract({ hours: 24 }),
        limit: 10,
      });

      expect(stale.map((card) => card.id)).toEqual(["old-ok", "old-ng"]);
    });

    it("limit で件数を抑える", async () => {
      const stale = await query.listStale({
        available: now.subtract({ hours: 24 * 14 }),
        unavailable: now.subtract({ hours: 24 }),
        limit: 1,
      });

      expect(stale.map((card) => card.id)).toEqual(["old-ok"]);
    });
  });
});
