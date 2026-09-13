import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedMenu, FeedMenuList } from "./feed-menu";
import { siteNavItems } from "~/frontend/components/layout/site-nav";
import { withI18n } from "~/frontend/lib/test-render";
import { feedIdentities } from "~/lib/feed";

const renderWithI18n = withI18n();

function feedHrefs(): (string | null)[] {
  return screen.getAllByRole("link").map((link) => link.getAttribute("href"));
}

describe("FeedMenu", () => {
  /*
   * 器は `<details>`。**JavaScript が動かない環境でも開ける**ようにするためで、
   * `<dialog>` や自前の開閉状態にすると、その環境では押しても何も起きない飾りになる。
   */
  it("器は details で、はじめは畳まれている", () => {
    const { container } = renderWithI18n(<FeedMenu />);

    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
  });

  it("表にある行き先をすべて並べる", () => {
    renderWithI18n(<FeedMenu />);

    expect(feedHrefs()).toEqual(feedIdentities.map((identity) => identity.path));
  });

  /*
   * **中身の無い種別も押せるままにする** (#412 / #415)。返るのは entry 0 件の Atom で、
   * いま購読しておけば中身が入った時点で届く。押せなくすると、その時点で購読している
   * 人が誰もいない状態から始まる。
   */
  it("まだ中身の無い種別も押せる", () => {
    renderWithI18n(<FeedMenu />);

    for (const name of ["Notes", "Slides"]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "href",
        `/feed/${name.toLowerCase()}.xml`,
      );
    }
  });

  /*
   * `<Link>` だと React Router が loader を取りに行って行き止まる。フィードは Hono が
   * 応答するエンドポイントなので、素の `<a>` で出すこと。
   */
  it("Atom であることを type で名乗る", () => {
    renderWithI18n(<FeedMenu />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("type", "application/atom+xml");
    }
  });
});

describe("FeedMenuList (ドロワー)", () => {
  /*
   * 帯とドロワーで出来ることを変えない。ここにだけ無い行き先を作ると、画面の幅で
   * 購読できるものが変わる。
   */
  it("帯と同じ行き先を並べる", () => {
    renderWithI18n(<FeedMenuList />);

    expect(feedHrefs()).toEqual(feedIdentities.map((identity) => identity.path));
  });

  /*
   * ドロワー自身が `<details>`。この中で更に畳むと、開くのに 2 手かかり、支援技術にも
   * 入れ子の開閉として伝わる。
   */
  it("畳まない (入れ子の details にしない)", () => {
    const { container } = renderWithI18n(<FeedMenuList />);

    expect(container.querySelector("details")).toBeNull();
  });
});

describe("フィードの種別とサイトの行き先", () => {
  /*
   * 種別はサイトの行き先と 1 対 1。**ナビに足した行き先はフィードにも要る** — 片方に
   * だけあると、読めるのに購読できない (あるいはその逆の) 場所が生まれる。
   *
   * About だけは持たない。時系列に並ぶものが無いページなので、購読しても何も届かない。
   */
  it("`all` を除くと、ナビの行き先とちょうど対応する (About を除く)", () => {
    const feedTargets = feedIdentities
      .filter((identity) => identity.kind !== "all")
      .map((identity) => identity.alternatePath);

    expect(feedTargets).toEqual(
      siteNavItems.map((item) => item.to).filter((to) => to !== "/about"),
    );
  });
});
