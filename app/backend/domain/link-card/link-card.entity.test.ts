import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { LinkCardUrl } from "./link-card-url.vo";
import { LinkCard, staleCutoffs } from "./link-card.entity";
import type { LinkCardImageState } from "./link-card.entity";

const url = LinkCardUrl.create("https://example.com/a");
const fetchedAt = Temporal.Instant.from("2026-01-01T00:00:00Z");

function availableCard(image: LinkCardImageState = "stored"): LinkCard {
  return LinkCard.available({
    id: "abc",
    url,
    metadata: {
      title: "例",
      description: undefined,
      siteName: undefined,
      image,
      hasFavicon: false,
    },
    fetchedAt,
  });
}

function unavailableCard(): LinkCard {
  return LinkCard.unavailable({ id: "abc", url, fetchedAt });
}

describe("LinkCard", () => {
  it("取得できたカードは中身を持つ", () => {
    const card = availableCard();
    expect(card.isAvailable).toBe(true);
    expect(card.metadata?.title).toBe("例");
  });

  it("取得できなかったカードは中身を持たない", () => {
    const card = unavailableCard();
    expect(card.isAvailable).toBe(false);
    expect(card.metadata).toBeUndefined();
  });

  describe("isStale", () => {
    it("取得できたカードは 14 日で古くなる", () => {
      const card = availableCard();
      expect(card.isStale(fetchedAt.add({ hours: 24 * 14 - 1 }))).toBe(false);
      expect(card.isStale(fetchedAt.add({ hours: 24 * 14 }))).toBe(true);
    });

    it("取得できなかったカードは 1 日で古くなる", () => {
      const card = unavailableCard();
      expect(card.isStale(fetchedAt.add({ hours: 23 }))).toBe(false);
      expect(card.isStale(fetchedAt.add({ hours: 24 }))).toBe(true);
    });

    it("絵だけ取り逃したカードは 1 日で古くなる", () => {
      const card = availableCard("missed");
      expect(card.isStale(fetchedAt.add({ hours: 23 }))).toBe(false);
      expect(card.isStale(fetchedAt.add({ hours: 24 }))).toBe(true);
    });

    it("絵を持たない相手のカードは 14 日待つ", () => {
      // 取り逃しと違い、短い間隔で叩き直しても結論は変わらない。
      const card = availableCard("absent");
      expect(card.isStale(fetchedAt.add({ hours: 24 * 14 - 1 }))).toBe(false);
      expect(card.isStale(fetchedAt.add({ hours: 24 * 14 }))).toBe(true);
    });

    it("前回の中身を持ちこたえているカードは 1 日で古くなる", () => {
      // 中身は在るが見せているのは古いもの。14 日ではなく短い側で確かめ直す。
      const card = LinkCard.afterFailedFetch({
        id: "abc",
        url,
        previous: availableCard(),
        now: fetchedAt,
      });
      expect(card.isStale(fetchedAt.add({ hours: 23 }))).toBe(false);
      expect(card.isStale(fetchedAt.add({ hours: 24 }))).toBe(true);
    });
  });

  describe("afterFailedFetch", () => {
    it("前回の中身があれば持ちこたえる", () => {
      const card = LinkCard.afterFailedFetch({
        id: "abc",
        url,
        previous: availableCard(),
        now: fetchedAt,
      });

      expect(card.isAvailable).toBe(true);
      expect(card.metadata?.title).toBe("例");
      // 今回が失敗の起点。
      expect(card.fetchFailedSince?.equals(fetchedAt)).toBe(true);
    });

    it("前回が無ければ素のリンクに落ちる", () => {
      const card = LinkCard.afterFailedFetch({
        id: "abc",
        url,
        previous: undefined,
        now: fetchedAt,
      });

      expect(card.isAvailable).toBe(false);
      expect(card.fetchFailedSince).toBeUndefined();
    });

    it("前回も中身が無ければ素のリンクのまま", () => {
      const card = LinkCard.afterFailedFetch({
        id: "abc",
        url,
        previous: unavailableCard(),
        now: fetchedAt.add({ hours: 24 }),
      });

      expect(card.isAvailable).toBe(false);
    });

    it("失敗が続いても起点は動かない", () => {
      // 起点まで進めてしまうと上限にいつまでも届かず、永久に持ちこたえてしまう。
      const first = LinkCard.afterFailedFetch({
        id: "abc",
        url,
        previous: availableCard(),
        now: fetchedAt,
      });
      const second = LinkCard.afterFailedFetch({
        id: "abc",
        url,
        previous: first,
        now: fetchedAt.add({ hours: 24 }),
      });

      expect(second.fetchFailedSince?.equals(fetchedAt)).toBe(true);
      expect(second.fetchedAt.equals(fetchedAt.add({ hours: 24 }))).toBe(true);
    });

    it("失敗し始めてから 3 日を越えると中身を捨てる", () => {
      const first = LinkCard.afterFailedFetch({
        id: "abc",
        url,
        previous: availableCard(),
        now: fetchedAt,
      });

      const justBefore = LinkCard.afterFailedFetch({
        id: "abc",
        url,
        previous: first,
        now: fetchedAt.add({ hours: 24 * 3 - 1 }),
      });
      expect(justBefore.isAvailable).toBe(true);

      const atLimit = LinkCard.afterFailedFetch({
        id: "abc",
        url,
        previous: first,
        now: fetchedAt.add({ hours: 24 * 3 }),
      });
      expect(atLimit.isAvailable).toBe(false);
      expect(atLimit.fetchFailedSince).toBeUndefined();
    });

    it("一度取れれば上限は測り直しになる", () => {
      const failed = LinkCard.afterFailedFetch({
        id: "abc",
        url,
        previous: availableCard(),
        now: fetchedAt,
      });
      expect(failed.fetchFailedSince?.equals(fetchedAt)).toBe(true);

      // 相手が戻り、また落ちた。前の失敗の分まで数えない。
      const recovered = availableCard();
      const again = LinkCard.afterFailedFetch({
        id: "abc",
        url,
        previous: recovered,
        now: fetchedAt.add({ hours: 24 * 10 }),
      });

      expect(again.isAvailable).toBe(true);
      expect(
        again.fetchFailedSince?.equals(fetchedAt.add({ hours: 24 * 10 })),
      ).toBe(true);
    });
  });
});

describe("staleCutoffs", () => {
  it("期限の境目を取得のされ方ごとに返す", () => {
    const now = Temporal.Instant.from("2026-02-01T00:00:00Z");
    const cutoffs = staleCutoffs(now);
    expect(cutoffs.available.toString()).toBe("2026-01-18T00:00:00Z");
    expect(cutoffs.unavailable.toString()).toBe("2026-01-31T00:00:00Z");
    expect(cutoffs.imageMissed.toString()).toBe("2026-01-31T00:00:00Z");
    expect(cutoffs.keptAfterFailure.toString()).toBe("2026-01-31T00:00:00Z");
  });
});
