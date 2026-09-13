import { describe, expect, it } from "vitest";
import { isCurrentNavItem, siteNavItems } from "./site-nav";

describe("isCurrentNavItem", () => {
  it("そのページを見ているとき", () => {
    expect(isCurrentNavItem("/articles", "/articles")).toBe(true);
  });

  /*
   * 記事を読んでいる最中も、一覧を現在地として示す。そうしないと、記事ページでは
   * ナビのどこにも印が付かず、サイトのどこにいるのかが分からなくなる。
   */
  it("その下のページを見ているとき", () => {
    expect(isCurrentNavItem("/articles/hacku-2016", "/articles")).toBe(true);
  });

  it("別の行き先を見ているとき", () => {
    expect(isCurrentNavItem("/notes", "/articles")).toBe(false);
    expect(isCurrentNavItem("/", "/articles")).toBe(false);
  });

  /*
   * 境目は区切りで見る。`startsWith` だけだと、いつか `/notes-archive` のような
   * 行き先が増えたときに `/notes` まで一緒に光る。
   */
  it("名前が前方一致するだけの別の行き先には広がらない", () => {
    expect(isCurrentNavItem("/notes-archive", "/notes")).toBe(false);
  });
});

describe("siteNavItems", () => {
  /*
   * 帯とドロワーが同じ表を読む。同じ行き先を 2 つ並べた回帰 (#154) が、書き足した
   * ときに再び起きないよう、表そのものを見張る。
   */
  it("同じ行き先を 2 つ持たない", () => {
    const destinations = siteNavItems.map((item) => item.to);

    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it("Home は置かない (ロゴがその役を兼ねる)", () => {
    expect(siteNavItems.some((item) => item.to === "/")).toBe(false);
  });
});
