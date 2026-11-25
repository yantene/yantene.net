import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedMenu, FeedMenuList } from "./feed-menu";
import { siteNavItems } from "~/frontend/components/layout/site-nav";
import { withI18n } from "~/frontend/lib/test-render";
import { feedIdentities, listedFeedIdentities } from "~/lib/feed";

const renderWithI18n = withI18n();

function feedHrefs(): (string | null)[] {
  return screen.getAllByRole("link").map((link) => link.getAttribute("href"));
}

describe("FeedMenu", () => {
  /*
   * 器は Popover API。**開閉は属性だけで決まるので、JavaScript が動かない環境でも
   * 開ける。** `<dialog>` を `showModal()` で開く形や自前の開閉状態にすると、その環境
   * では押しても何も起きない飾りになる。
   */
  it("押し場所が popovertarget で板を指し、板は auto の popover", () => {
    const { container } = renderWithI18n(<FeedMenu />);

    const trigger = screen.getByRole("button", { name: "Feed" });
    const panelId = trigger.getAttribute("popovertarget");
    expect(panelId).toBeTruthy();
    const panel = container.querySelector(`[id="${panelId}"]`);
    expect(panel).toHaveAttribute("popover", "auto");
    // 板は押し場所のすぐ後ろ (離すとブラウザが暗黙の aria-details を足す)。
    expect(trigger.nextElementSibling).toBe(panel);
    expect(container.querySelector("details")).toBeNull();
  });

  it("選び場所に出す行き先をすべて並べる", () => {
    renderWithI18n(<FeedMenu />);

    expect(feedHrefs()).toEqual(listedFeedIdentities.map((identity) => identity.path));
  });

  /*
   * **中身の無い種別も押せるままにする** (#415)。返るのは entry 0 件の Atom で、
   * いま購読しておけば中身が入った時点で届く。押せなくすると、その時点で購読している
   * 人が誰もいない状態から始まる。
   */
  it("まだ中身の無い種別も押せる", () => {
    renderWithI18n(<FeedMenu />);

    expect(screen.getByRole("link", { name: "Slides" })).toHaveAttribute(
      "href",
      "/feed/slides.xml",
    );
  });

  /*
   * Notes は何を置く場所にするかが決まっていない (#412)。ナビが名乗っていない場所を
   * ここだけが名乗らないこと。
   */
  it("Notes は並べない", () => {
    renderWithI18n(<FeedMenu />);

    expect(screen.queryByRole("link", { name: "Notes" })).toBeNull();
    expect(feedHrefs()).not.toContain("/feed/notes.xml");
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

    expect(feedHrefs()).toEqual(listedFeedIdentities.map((identity) => identity.path));
  });

  it("Notes は並べない", () => {
    renderWithI18n(<FeedMenuList />);

    expect(feedHrefs()).not.toContain("/feed/notes.xml");
  });

  /*
   * ドロワー自身が畳んだ板 (popover)。この中で更に畳むと、開くのに 2 手かかり、支援技術
   * にも入れ子の開閉として伝わる。
   */
  it("畳まない (入れ子の開閉にしない)", () => {
    const { container } = renderWithI18n(<FeedMenuList />);

    expect(container.querySelector("details, [popover], [popovertarget]")).toBeNull();
  });
});

describe("フィードの種別とサイトの行き先", () => {
  /*
   * 時系列に並ぶものを置く場所は、ナビの行き先と選び場所に出すフィードが 1 対 1。
   * **そちらに足した行き先はフィードにも要る** — 片方にだけあると、読めるのに購読
   * できない (あるいはその逆の) 場所が生まれる。
   *
   * 時系列で増えない 2 つは持たない。`/about` は 1 枚しか無く、`/works` は書き手が
   * 手で並べたものなので、どちらも購読しても何も届かない (ADR 0042)。
   */
  const timelessPaths = new Set(["/about", "/works"]);

  it("`all` を除くと、時系列の行き先とちょうど対応する", () => {
    const feedTargets = listedFeedIdentities
      .filter((identity) => identity.kind !== "all")
      .map((identity) => identity.alternatePath);

    expect(feedTargets).toEqual(
      siteNavItems.map((item) => item.to).filter((to) => !timelessPaths.has(to)),
    );
  });

  /*
   * **選び場所から外しても、フィードは消さない。** URL は購読された時点で動かせない
   * 契約になる。`/feed/notes.xml` は entry 0 件の Atom として実在し続ける
   * (応答そのものは backend/handlers/feed.handler.test.ts が見ている)。
   */
  it("選び場所に出さない種別も、フィードとしては実在する", () => {
    const paths = feedIdentities.map((identity) => identity.path);

    expect(paths).toContain("/feed/notes.xml");
    expect(siteNavItems.map((item) => item.to)).not.toContain("/notes");
  });
});
