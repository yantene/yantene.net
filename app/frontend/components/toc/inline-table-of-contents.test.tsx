import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { InlineTableOfContents } from "./inline-table-of-contents";
import { InlineTocRegistry } from "./inline-toc-registry";
import { TocHeadingsContext } from "./toc-context";
import type { TocHeading } from "~/backend/handlers/articles/toc-headings";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();

/** 見出しの列を与えて描く。Link を使うので Router の中で。 */
function renderToc(headings: readonly TocHeading[]): HTMLElement {
  const Stub = createRoutesStub([
    {
      path: "/articles/:slug",
      Component: () => (
        <TocHeadingsContext value={headings}>
          <InlineTableOfContents />
        </TocHeadingsContext>
      ),
    },
  ]);
  return renderWithI18n(<Stub initialEntries={["/articles/foo"]} />, { router: false }).container;
}

const section = (id: string, text: string): TocHeading => ({ id, text, level: 2 });
const subsection = (id: string, text: string): TocHeading => ({ id, text, level: 3 });

describe("InlineTableOfContents", () => {
  /*
   * 節名バーは「目次を通り過ぎたか」を見張るために、この要素を受け取る。預けるのをやめても
   * 型は通り、目次そのものは描かれ続けるので、バーが静かに出なくなるだけになる。形で固定する。
   */
  it("自分の要素を預ける (節名バーが見張る先になる)", () => {
    let registered: HTMLElement | null = null;
    const Stub = createRoutesStub([
      {
        path: "/articles/:slug",
        Component: () => (
          <InlineTocRegistry
            value={(element) => {
              registered = element;
            }}
          >
            <TocHeadingsContext value={[section("a", "ひとつ"), section("b", "ふたつ")]}>
              <InlineTableOfContents />
            </TocHeadingsContext>
          </InlineTocRegistry>
        ),
      },
    ]);
    const { container } = renderWithI18n(<Stub initialEntries={["/articles/foo"]} />, {
      router: false,
    });
    expect(registered).toBe(container.querySelector("nav.inline-toc"));
  });

  it("節を並べる", () => {
    const container = renderToc([section("a", "ひとつ"), section("b", "ふたつ")]);
    const links = [...container.querySelectorAll("a")];
    expect(links.map((link) => link.textContent)).toEqual(["ひとつ", "ふたつ"]);
    // Link がいまのパスからの絶対パスに直す。行き先は本文の見出しの id。
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/articles/foo#a",
      "/articles/foo#b",
    ]);
  });

  it("h3 も並べる。字を下げて節の中だと分かるようにする", () => {
    const container = renderToc([
      section("a", "ひとつ"),
      subsection("a-1", "その中"),
      section("b", "ふたつ"),
    ]);
    expect([...container.querySelectorAll("a")].map((link) => link.textContent)).toEqual([
      "ひとつ",
      "その中",
      "ふたつ",
    ]);
    // 字下げは h3 にだけ付く。
    expect(
      [...container.querySelectorAll("a")].map((link) =>
        link.className.includes("inline-toc-link-sub"),
      ),
    ).toEqual([false, true, false]);
  });

  /*
   * 見出しの総数で数えると、h3 だけが多い記事で 1 項目の目次が出る。押せる場所が
   * 増えるだけで全体像を伝えないので、節の数で数える。
   */
  /* 出し止めは節 (h2) の数で決める。h3 がいくつあっても節が 1 つなら出さない。 */
  it("節が 1 つなら、h3 がいくつあっても描かない", () => {
    const container = renderToc([
      section("a", "ひとつ"),
      subsection("a-1", "その中"),
      subsection("a-2", "その次"),
    ]);
    expect(container.querySelector("nav.inline-toc")).toBeNull();
  });

  it("見出しが無ければ描かない", () => {
    expect(renderToc([]).querySelector("nav.inline-toc")).toBeNull();
  });

  /*
   * 畳まない。読み始める前に構造を見せるためのものなので、開くひと手間を挟むと
   * 置いている意味が薄れる。読み進めてからの入口は上端の節名バーが別に持っている。
   */
  it("畳まずに、見出しを添えて出す", () => {
    const container = renderToc([section("a", "ひとつ"), section("b", "ふたつ")]);
    expect(container.querySelector("details")).toBeNull();
    // 場所の名前は日本語モードでも英語のまま (app/lib/i18n/locales/locales.test.ts)。
    expect(container.querySelector(".inline-toc-heading")?.textContent).toBe("Contents");
    expect(container.querySelectorAll("a")).toHaveLength(2);
  });
});
