import { act, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, useLocation } from "react-router";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MdastRenderer } from "./mdast-renderer";
import type { Root as MdastRoot } from "mdast";
import type { ArticlePreview } from "~/backend/handlers/articles/preview.handler";
import { parseArticleContent } from "~/backend/services/article-content-parser";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n("ja");

function md(markdown: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

const article = [
  "本文[^1]と[内部リンク](/articles/other)と[外部リンク](https://example.com/)。",
  "[^1]: 注の中身。[注の中のリンク](https://example.org/)も置ける。",
].join("\n\n");

/** 属性の名前の列。値は問わず「何が付いているか」だけを比べる。 */
function attributeNames(element: Element | null): readonly string[] {
  if (element === null) throw new Error("要素が描かれていない");
  return element.getAttributeNames().toSorted();
}

/**
 * JavaScript が動かないときに読み手へ届く HTML。
 *
 * **プレビューを足しても、サーバーの出力は今までと同じ形であること。** チップも
 * ドロワーも読み手が触ってから出すので、ここには何も現れない。脚注へ飛ぶリンクも、
 * 末尾の脚注一覧も、そのまま残る。
 */
describe("MdastRenderer: プレビューを足しても SSR の出力は今どおり", () => {
  function ssr(markdown: string): Document {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/articles/foo"]}>
        <MdastRenderer lang="ja" node={md(markdown)} className="e-content" />
      </MemoryRouter>,
    );
    return new DOMParser().parseFromString(html, "text/html");
  }

  it("renders no chip, no drawer and no anchor mark", () => {
    const document = ssr(article);

    expect(document.querySelector("[popover]")).toBeNull();
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.querySelector("[data-preview-anchor]")).toBeNull();
  });

  it("keeps the footnote reference as the same in-page link", () => {
    const reference = ssr(article).querySelector("sup > a");

    expect(reference?.getAttribute("href")).toBe("/articles/foo#user-content-fn-1");
    expect(reference?.id).toBe("user-content-fnref-1");
    // 足してよい属性は無い。出来事への反応は属性として HTML に出ない。
    expect(attributeNames(reference)).toEqual([
      "aria-describedby",
      "class",
      "data-discover",
      "data-footnote-ref",
      "href",
      "id",
    ]);
  });

  it("keeps the footnote list at the end, with the way back", () => {
    const document = ssr(article);

    const item = document.querySelector("section[data-footnotes] li#user-content-fn-1");
    expect(item?.textContent).toContain("注の中身。");
    expect(item?.querySelector("a[data-footnote-backref]")).not.toBeNull();
  });

  it("keeps the internal link as a plain anchor", () => {
    const link = ssr(article).querySelector('a[href="/articles/other"]');

    expect(link?.textContent).toBe("内部リンク");
    expect(attributeNames(link)).toEqual(["class", "href"]);
  });

  /*
   * 本文 (`e-content`) の中に脚注の写しを置くと、microformats のパーサが読む記事の
   * 中身に同じ文が 2 回入る。
   */
  /*
   * 本文の言語は器に付く。`<html lang>` は UI の言語なので、ここで言い直さないと英語の UI で
   * 日本語の本文が英語の声で読まれる。
   */
  it("puts the content language on the article", () => {
    expect(ssr(article).querySelector("article")?.getAttribute("lang")).toBe("ja");
  });

  it("does not copy the footnote into the content", () => {
    const content = ssr(article).querySelector(".e-content")?.textContent ?? "";

    expect(content.split("注の中身。")).toHaveLength(2);
  });
});

describe("MdastRenderer: ホバーとフォーカスで出るチップ", () => {
  const showPopover = vi.fn();

  function chip(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>(".preview-chip");
  }

  function reference(container: HTMLElement): HTMLAnchorElement {
    const found = container.querySelector<HTMLAnchorElement>("sup > a");
    if (found === null) throw new Error("脚注の参照が描かれていない");
    return found;
  }

  function internalLink(container: HTMLElement, slug: string): HTMLAnchorElement {
    const found = container.querySelector<HTMLAnchorElement>(`a[href="/articles/${slug}"]`);
    if (found === null) throw new Error("内部リンクが描かれていない");
    return found;
  }

  /** 時計を進め、その間に解けた約束と、それに続く描き直しまで済ませる。 */
  async function advance(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  function stubPreview(preview: ArticlePreview | null): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        preview === null ? new Response("{}", { status: 404 }) : Response.json(preview),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // happy-dom は Popover API を持たない。持っているブラウザの形にする。
    Object.defineProperty(HTMLElement.prototype, "showPopover", {
      configurable: true,
      value: showPopover,
    });
    showPopover.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
  });

  it("shows the footnote only after the cursor has rested on the reference", async () => {
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);

    fireEvent.pointerEnter(reference(container));
    await advance(299);
    expect(chip()).toBeNull();

    await advance(1);
    expect(chip()?.textContent).toContain("注の中身。");
    expect(showPopover).toHaveBeenCalledTimes(1);
  });

  it("does not show a chip for a cursor that only passes over", async () => {
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);

    fireEvent.pointerEnter(reference(container));
    await advance(200);
    fireEvent.pointerLeave(reference(container));
    await advance(1000);

    expect(chip()).toBeNull();
  });

  it("opens the chip as a popover, outside the content", async () => {
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);

    fireEvent.pointerEnter(reference(container));
    await advance(300);

    expect(chip()?.getAttribute("popover")).toBe("manual");
    expect(container.contains(chip())).toBe(false);
  });

  /*
   * チップは `<article lang>` の外 (body の下) に出るので、言語を継げない。脚注の中身に
   * 本文と同じ言語を付け直す。
   */
  it("gives the footnote in the chip the language of the body", async () => {
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);

    fireEvent.pointerEnter(reference(container));
    await advance(300);

    expect(chip()?.querySelector(".preview-footnote")?.getAttribute("lang")).toBe("ja");
  });

  /*
   * 位置合わせは CSS が持つ。JavaScript が渡すのは「どのリンクを指しているか」の印だけで、
   * 座標は書かない。
   */
  it("marks the hovered reference as the anchor without writing any position", async () => {
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);

    fireEvent.pointerEnter(reference(container));
    await advance(300);

    expect(reference(container).dataset.previewAnchor).toBe("");
    expect(document.querySelectorAll("[data-preview-anchor]")).toHaveLength(1);
    expect(document.querySelector("[style]")).toBeNull();
  });

  /*
   * 支援技術には、チップをリンクの説明として渡す。押せば行き先へ移るリンクなので、
   * `aria-expanded` は付けない。
   */
  it("describes the reference with the chip only while it is shown", async () => {
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);
    const own = reference(container).getAttribute("aria-describedby");

    fireEvent.pointerEnter(reference(container));
    await advance(300);

    const id = chip()?.id ?? "";
    expect(id).not.toBe("");
    expect(chip()?.getAttribute("role")).toBe("tooltip");
    // 脚注一覧の見出しを指す元の説明は残したまま、後ろに足す。
    expect(reference(container).getAttribute("aria-describedby")).toBe(`${own} ${id}`);
    expect(reference(container).hasAttribute("aria-expanded")).toBe(false);

    fireEvent.pointerLeave(reference(container));
    await advance(150);
    expect(reference(container).getAttribute("aria-describedby")).toBe(own);
  });

  it("describes an internal link with its preview only while it is shown", async () => {
    stubPreview({
      slug: "described",
      title: "題",
      summary: "",
      publishedOn: "2026-01-15",
      imageUrl: null,
      language: "ja",
    });
    const { container } = renderWithI18n(
      <MdastRenderer lang="ja" node={md("[x](/articles/described)")} />,
    );
    const link = internalLink(container, "described");

    fireEvent.focus(link);
    await advance(300);
    expect(link.getAttribute("aria-describedby")).toBe(chip()?.id);

    fireEvent.blur(link);
    await advance(150);
    expect(link.hasAttribute("aria-describedby")).toBe(false);
  });

  it("renders the footnote as the body does, without the way back", async () => {
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);

    fireEvent.pointerEnter(reference(container));
    await advance(300);

    // 注の中の外部リンクは、本文と同じく別タブで開き rel が付く。
    const link = chip()?.querySelector('a[href="https://example.org/"]');
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    // 戻りの矢印は要らない。チップは参照のすぐ脇に出ている。
    expect(chip()?.querySelector("[data-footnote-backref]")).toBeNull();
    expect(chip()?.querySelector(".mdast-prose")).not.toBeNull();
  });

  it("does not duplicate ids that already live in the footnote list", async () => {
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);

    fireEvent.pointerEnter(reference(container));
    await advance(300);

    expect(chip()?.querySelector("[id]")).toBeNull();
  });

  it("renders math in the footnote as the body does", async () => {
    // 数式は refresh のときに MathML へ組まれる。本番と同じ経路で MDAST を作る。
    const { mdast } = parseArticleContent("本文[^1]\n\n[^1]: 注の式 $x^2$ を置く。\n");
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={mdast} />);

    fireEvent.pointerEnter(reference(container));
    await advance(300);

    expect(chip()?.querySelector("math")).not.toBeNull();
  });

  it("stays open while the cursor moves from the reference onto the chip", async () => {
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);
    fireEvent.pointerEnter(reference(container));
    await advance(300);

    fireEvent.pointerLeave(reference(container));
    await advance(100);
    const open = chip();
    if (open === null) throw new Error("チップが渡り切る前に閉じた");
    fireEvent.pointerEnter(open);
    await advance(5000);

    expect(chip()).not.toBeNull();
  });

  it("closes soon after the cursor leaves", async () => {
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);
    fireEvent.pointerEnter(reference(container));
    await advance(300);

    fireEvent.pointerLeave(reference(container));
    await advance(150);

    expect(chip()).toBeNull();
    expect(document.querySelector("[data-preview-anchor]")).toBeNull();
  });

  it("closes on Escape and does not come back while the cursor is still there", async () => {
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);
    fireEvent.pointerEnter(reference(container));
    await advance(300);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(chip()).toBeNull();

    fireEvent.pointerEnter(reference(container));
    await advance(5000);
    expect(chip()).toBeNull();
  });

  it("shows the footnote on keyboard focus too", async () => {
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);

    fireEvent.focus(reference(container));
    await advance(300);
    expect(chip()?.textContent).toContain("注の中身。");

    fireEvent.blur(reference(container));
    await advance(150);
    expect(chip()).toBeNull();
  });

  it("does not open chips from links inside the chip", async () => {
    const nested = "本文[^1]\n\n[^1]: 注から[別の記事](/articles/nested-in-chip)へ。\n";
    const fetchMock = stubPreview(null);
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(nested)} />);
    fireEvent.pointerEnter(reference(container));
    await advance(300);

    const inner = chip()?.querySelector("a");
    if (inner === null || inner === undefined) throw new Error("注の中のリンクが描かれていない");
    fireEvent.pointerEnter(inner);
    await advance(5000);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the preview of an internal link on hover and shows its title", async () => {
    const fetchMock = stubPreview({
      slug: "hover-once",
      title: "リンク先の題",
      summary: "リンク先の要約。",
      publishedOn: "2026-01-15",
      imageUrl: "/api/v1/articles/hover-once/assets/cover.png",
      language: "ja",
    });
    const { container } = renderWithI18n(
      <MdastRenderer lang="ja" node={md("[x](/articles/hover-once)")} />,
    );
    const link = internalLink(container, "hover-once");

    fireEvent.pointerEnter(link);
    await advance(299);
    // 待ちが明けるまでは取りに行かない。通り過ぎただけのカーソルで通信しない。
    expect(fetchMock).not.toHaveBeenCalled();

    await advance(1);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/v1/articles/hover-once/preview");
    expect(chip()?.textContent).toContain("リンク先の題");
    expect(chip()?.textContent).toContain("リンク先の要約。");
    expect(chip()?.textContent).toContain("2026.01.15");
    // カバー画像は返ってくるが、チップには描かない。
    expect(chip()?.querySelector("img")).toBeNull();
  });

  /* 題と要約の言語はリンク先の記事のもの。いま開いている本文の言語ではない。 */
  it("labels the previewed title and summary with the language of the linked article", async () => {
    stubPreview({
      slug: "in-english",
      title: "An English title",
      summary: "An English summary.",
      publishedOn: "2026-01-15",
      imageUrl: null,
      language: "en",
    });
    const { container } = renderWithI18n(
      <MdastRenderer lang="ja" node={md("[x](/articles/in-english)")} />,
    );

    fireEvent.pointerEnter(internalLink(container, "in-english"));
    await advance(300);

    expect(chip()?.querySelector(".article-preview-title")?.getAttribute("lang")).toBe("en");
    expect(chip()?.querySelector(".article-preview-summary")?.getAttribute("lang")).toBe("en");
    // 日付は UI の言語のまま。
    expect(chip()?.querySelector("time")?.hasAttribute("lang")).toBe(false);
  });

  it("does not fetch the same preview twice", async () => {
    const fetchMock = stubPreview({
      slug: "hover-twice",
      title: "題",
      summary: "",
      publishedOn: "2026-01-15",
      imageUrl: null,
      language: "ja",
    });
    const { container } = renderWithI18n(
      <MdastRenderer
        lang="ja"
        node={md("[x](/articles/hover-twice) [y](/articles/hover-twice)")}
      />,
    );
    const [first, second] = container.querySelectorAll("a");
    if (first === undefined || second === undefined) throw new Error("リンクが 2 本無い");

    fireEvent.pointerEnter(first);
    await advance(300);
    fireEvent.pointerLeave(first);
    await advance(150);
    fireEvent.pointerEnter(second);
    await advance(300);

    expect(chip()?.textContent).toContain("題");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 錨は、触られた 1 本だけ。同じ記事へのリンクが 2 本あっても取り違えない。
    expect(second.dataset.previewAnchor).toBe("");
    expect(first.dataset.previewAnchor).toBeUndefined();
  });

  it("leaves a link to an article readers cannot see as a plain link", async () => {
    stubPreview(null);
    const { container } = renderWithI18n(
      <MdastRenderer lang="ja" node={md("[x](/articles/a-draft)")} />,
    );

    fireEvent.pointerEnter(internalLink(container, "a-draft"));
    await advance(5000);

    expect(chip()).toBeNull();
  });

  it("does not show a preview that arrives after the cursor has left", async () => {
    let respond: (response: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            respond = resolve;
          }),
      ),
    );
    const { container } = renderWithI18n(
      <MdastRenderer lang="ja" node={md("[x](/articles/slow-one)")} />,
    );
    const link = internalLink(container, "slow-one");

    fireEvent.pointerEnter(link);
    await advance(300);
    fireEvent.pointerLeave(link);
    respond(
      Response.json({ slug: "slow-one", title: "遅い", summary: "", publishedOn: "2026-01-15" }),
    );
    await advance(5000);

    expect(chip()).toBeNull();
  });

  it("does not offer chips for external links", async () => {
    const fetchMock = stubPreview(null);
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);
    const external = container.querySelector('a[href="https://example.com/"]');
    if (external === null) throw new Error("外部リンクが描かれていない");

    fireEvent.pointerEnter(external);
    await advance(5000);

    expect(chip()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing where the Popover API is missing", async () => {
    Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
    const { container } = renderWithI18n(<MdastRenderer lang="ja" node={md(article)} />);

    fireEvent.pointerEnter(reference(container));
    await advance(5000);

    expect(chip()).toBeNull();
  });
});

describe("MdastRenderer: タッチでは脚注をドロワーで出す", () => {
  /** Router が見ている hash。ページ内ジャンプが起きたかを読む。 */
  function Hash(): React.JSX.Element {
    return <output>{useLocation().hash}</output>;
  }

  function drawer(): HTMLDialogElement | null {
    return document.body.querySelector<HTMLDialogElement>("dialog.footnote-drawer");
  }

  function renderArticle(): HTMLElement {
    return renderWithI18n(
      <>
        <MdastRenderer lang="ja" node={md(article)} />
        <Hash />
      </>,
    ).container;
  }

  function reference(container: HTMLElement): HTMLAnchorElement {
    const found = container.querySelector<HTMLAnchorElement>("sup > a");
    if (found === null) throw new Error("脚注の参照が描かれていない");
    return found;
  }

  beforeEach(() => {
    // ホバーできない・指で触る環境。
    vi.spyOn(globalThis, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
    Object.defineProperty(HTMLElement.prototype, "showPopover", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
  });

  it("opens the footnote in a modal drawer instead of jumping", () => {
    const container = renderArticle();

    fireEvent.click(reference(container));

    expect(drawer()?.open).toBe(true);
    expect(drawer()?.textContent).toContain("注の中身。");
    expect(drawer()?.querySelector("[data-footnote-backref]")).toBeNull();
    // ページ内ジャンプはしていない。
    expect(container.querySelector("output")?.textContent).toBe("");
  });

  it("names the drawer and its close button for the reader", () => {
    const container = renderArticle();

    fireEvent.click(reference(container));

    expect(drawer()?.getAttribute("aria-label")).toBe("脚注");
    expect(drawer()?.querySelector("button")?.textContent).toBe("閉じる");
  });

  /* ドロワーも body の下に出る。脚注の中身は本文の言語で、閉じるボタンは UI の言語のまま。 */
  it("gives the footnote in the drawer the language of the body", () => {
    const container = renderArticle();

    fireEvent.click(reference(container));

    expect(drawer()?.querySelector(".preview-footnote")?.getAttribute("lang")).toBe("ja");
    expect(drawer()?.hasAttribute("lang")).toBe(false);
  });

  it("closes with the close button", () => {
    const container = renderArticle();
    fireEvent.click(reference(container));

    const button = drawer()?.querySelector("button");
    if (button === null || button === undefined) throw new Error("閉じるボタンが無い");
    fireEvent.click(button);

    expect(drawer()).toBeNull();
  });

  it("closes when the backdrop is pressed, but not when the footnote itself is", () => {
    const container = renderArticle();
    fireEvent.click(reference(container));
    const open = drawer();
    if (open === null) throw new Error("ドロワーが開いていない");

    const body = open.querySelector(".footnote-drawer-body");
    if (body === null) throw new Error("ドロワーの中身が無い");
    fireEvent.click(body);
    expect(drawer()).not.toBeNull();

    // `::backdrop` を押した出来事は dialog 自身に届く。
    fireEvent.click(open);
    expect(drawer()).toBeNull();
  });

  it("closes when swiped down", () => {
    const container = renderArticle();
    fireEvent.click(reference(container));
    const open = drawer();
    if (open === null) throw new Error("ドロワーが開いていない");

    fireEvent.touchStart(open, { touches: [{ clientY: 400 }] });
    fireEvent.touchEnd(open, { changedTouches: [{ clientY: 480 }] });

    expect(drawer()).toBeNull();
  });

  it("stays open for a finger that barely moved", () => {
    const container = renderArticle();
    fireEvent.click(reference(container));
    const open = drawer();
    if (open === null) throw new Error("ドロワーが開いていない");

    fireEvent.touchStart(open, { touches: [{ clientY: 400 }] });
    fireEvent.touchEnd(open, { changedTouches: [{ clientY: 420 }] });

    expect(drawer()).not.toBeNull();
  });

  it("leaves a modified click to the browser", () => {
    const container = renderArticle();

    fireEvent.click(reference(container), { ctrlKey: true });

    expect(drawer()).toBeNull();
  });

  it("does not offer chips, and leaves internal links alone", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const container = renderArticle();
    const link = container.querySelector('a[href="/articles/other"]');
    if (link === null) throw new Error("内部リンクが描かれていない");

    fireEvent.pointerEnter(link);
    fireEvent.pointerEnter(reference(container));
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(document.body.querySelector(".preview-chip")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

describe("MdastRenderer: ホバーできる環境で脚注の参照を押す", () => {
  it("jumps to the footnote as before, without a drawer", () => {
    function Hash(): React.JSX.Element {
      return <output>{useLocation().hash}</output>;
    }
    const { container } = renderWithI18n(
      <>
        <MdastRenderer lang="ja" node={md(article)} />
        <Hash />
      </>,
    );
    const reference = container.querySelector("sup > a");
    if (reference === null) throw new Error("脚注の参照が描かれていない");

    fireEvent.click(reference);

    expect(document.body.querySelector("dialog")).toBeNull();
    expect(container.querySelector("output")?.textContent).toBe("#user-content-fn-1");
  });
});
