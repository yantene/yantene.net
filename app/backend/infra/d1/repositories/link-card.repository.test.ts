import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it } from "vitest";
import { D1LinkCardCommandRepository } from "./link-card.command-repository";
import { D1LinkCardQueryRepository } from "./link-card.query-repository";
import type { LinkCardImageState } from "~/backend/domain/link-card";
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
  image?: LinkCardImageState;
}): LinkCard {
  return LinkCard.available({
    id: params.id,
    url: url(params.raw),
    metadata: {
      title: "題",
      description: "説明",
      siteName: "サイト",
      image: params.image ?? "stored",
      hasFavicon: false,
    },
    fetchedAt: params.fetchedAt ?? now,
  });
}

/** 期限の境目。ドメインの決めた値と同じ刻みで渡す。 */
function cutoffs(): {
  available: Temporal.Instant;
  unavailable: Temporal.Instant;
  imageMissed: Temporal.Instant;
} {
  return {
    available: now.subtract({ hours: 24 * 14 }),
    unavailable: now.subtract({ hours: 24 }),
    imageMissed: now.subtract({ hours: 24 }),
  };
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
      image: "stored",
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
      availableCard({
        id: "a1",
        raw: "https://example.com/a",
        image: "stored",
      }),
    );
    await command.upsert(
      availableCard({
        id: "a1",
        raw: "https://example.com/a",
        image: "absent",
      }),
    );

    const [found] = await query.findByUrls([url("https://example.com/a")]);
    expect(found.metadata?.image).toBe("absent");
  });

  it("絵を取り逃したことも覚えておける", async () => {
    // 「絵が無い」と同じ 0 に畳むと、短い期限で取り直す相手が分からなくなる。
    await command.upsert(
      availableCard({
        id: "a1",
        raw: "https://example.com/a",
        image: "missed",
      }),
    );

    const [found] = await query.findByUrls([url("https://example.com/a")]);
    expect(found.metadata?.image).toBe("missed");
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

    it("取得のされ方ごとの期限で絞り、古い順に返す", async () => {
      const stale = await query.listStale({ ...cutoffs(), limit: 10 });

      expect(stale.map((card) => card.id)).toEqual(["old-ok", "old-ng"]);
    });

    it("limit で件数を抑える", async () => {
      const stale = await query.listStale({ ...cutoffs(), limit: 1 });

      expect(stale.map((card) => card.id)).toEqual(["old-ok"]);
    });

    it("絵を取り逃したカードは 14 日を待たずに拾う", async () => {
      // 題が取れているので「取得できた」の側だが、2 日前の取り逃しは短い境目で拾う。
      await command.upsert(
        availableCard({
          id: "missed-img",
          raw: "https://example.com/missed-img",
          image: "missed",
          fetchedAt: now.subtract({ hours: 48 }),
        }),
      );

      const stale = await query.listStale({ ...cutoffs(), limit: 10 });

      expect(stale.map((card) => card.id)).toContain("missed-img");
    });

    it("取り逃してから 1 日経っていないカードは拾わない", async () => {
      await command.upsert(
        availableCard({
          id: "fresh-missed-img",
          raw: "https://example.com/fresh-missed-img",
          image: "missed",
          fetchedAt: now.subtract({ hours: 1 }),
        }),
      );

      const stale = await query.listStale({ ...cutoffs(), limit: 10 });

      expect(stale.map((card) => card.id)).not.toContain("fresh-missed-img");
    });
  });
});
