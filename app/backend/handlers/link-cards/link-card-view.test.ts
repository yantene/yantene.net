import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { toLinkCardMap, toLinkCardView } from "./link-card-view";
import { LinkCard, LinkCardUrl } from "~/backend/domain/link-card";

const fetchedAt = Temporal.Instant.from("2026-02-01T00:00:00Z");

function card(params: {
  id: string;
  raw: string;
  hasImage?: boolean;
  hasFavicon?: boolean;
}): LinkCard {
  return LinkCard.available({
    id: params.id,
    url: LinkCardUrl.create(params.raw),
    metadata: {
      title: "題",
      description: "説明",
      siteName: "サイト",
      hasImage: params.hasImage ?? false,
      hasFavicon: params.hasFavicon ?? false,
    },
    fetchedAt,
  });
}

/** 16 進 32 文字であればよい。中身に意味は無いので目に付く形にしておく。 */
const ID = "a".repeat(32);

describe("toLinkCardView", () => {
  it("画像は自分の配信 URL を指す", () => {
    const view = toLinkCardView(
      card({
        id: ID,
        raw: "https://example.com/a",
        hasImage: true,
        hasFavicon: true,
      }),
    );

    expect(view).toEqual({
      url: "https://example.com/a",
      title: "題",
      description: "説明",
      siteName: "サイト",
      imageUrl: `/api/v1/link-cards/${ID}/image`,
      faviconUrl: `/api/v1/link-cards/${ID}/favicon`,
    });
  });

  it("画像が無ければ null にする", () => {
    const view = toLinkCardView(
      card({ id: "abc", raw: "https://example.com/a" }),
    );

    expect(view?.imageUrl).toBeNull();
    expect(view?.faviconUrl).toBeNull();
  });

  it("取得できなかったカードは外に出さない", () => {
    const view = toLinkCardView(
      LinkCard.unavailable({
        id: "abc",
        url: LinkCardUrl.create("https://example.com/a"),
        fetchedAt,
      }),
    );

    expect(view).toBeUndefined();
  });
});

describe("toLinkCardMap", () => {
  it("URL をキーにした表にする", () => {
    const map = toLinkCardMap([
      card({ id: "a", raw: "https://example.com/a" }),
      card({ id: "b", raw: "https://example.com/b" }),
    ]);

    expect(Object.keys(map)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("取得できなかったカードは表に載せない", () => {
    const map = toLinkCardMap([
      card({ id: "a", raw: "https://example.com/a" }),
      LinkCard.unavailable({
        id: "b",
        url: LinkCardUrl.create("https://example.com/b"),
        fetchedAt,
      }),
    ]);

    expect(Object.keys(map)).toEqual(["https://example.com/a"]);
  });
});
