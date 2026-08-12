import { render } from "@testing-library/react";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { MdastRenderer } from "./mdast-renderer";
import type { Root as MdastRoot } from "mdast";
import type { LinkCardMap } from "~/backend/handlers/link-cards/link-card-view";

function md(markdown: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

const cards: LinkCardMap = {
  "https://example.com/a": {
    url: "https://example.com/a",
    title: "カードの題",
    description: "カードの説明",
    siteName: "サイト名",
    imageUrl: "/api/v1/link-cards/abc/image",
    faviconUrl: "/api/v1/link-cards/abc/favicon",
  },
};

describe("MdastRenderer のリンクカード", () => {
  it("むき出しの URL だけの段落をカードに差し替える", () => {
    const { container } = render(
      <MdastRenderer node={md("https://example.com/a\n")} linkCards={cards} />,
    );

    const card = container.querySelector(":scope a.link-card");
    expect(card?.getAttribute("href")).toBe("https://example.com/a");
    expect(card?.textContent).toContain("カードの題");
    expect(card?.textContent).toContain("サイト名");
    expect(
      card
        ?.querySelector(":scope .link-card-thumbnail img")
        ?.getAttribute("src"),
    ).toBe("/api/v1/link-cards/abc/image");
    expect(
      card?.querySelector(":scope .link-card-favicon")?.getAttribute("src"),
    ).toBe("/api/v1/link-cards/abc/favicon");
  });

  it("カードにした段落は素の段落として残さない", () => {
    const { container } = render(
      <MdastRenderer node={md("https://example.com/a\n")} linkCards={cards} />,
    );

    expect(container.querySelectorAll(":scope p")).toHaveLength(0);
  });

  it("カードが無い URL は素のリンクのまま描く", () => {
    const { container } = render(
      <MdastRenderer
        node={md("https://example.com/unknown\n")}
        linkCards={cards}
      />,
    );

    expect(container.querySelector(":scope a.link-card")).toBeNull();
    const link = container.querySelector(":scope p a");
    expect(link?.getAttribute("href")).toBe("https://example.com/unknown");
    expect(link?.textContent).toBe("https://example.com/unknown");
  });

  it("linkCards を渡さなければ何も差し替えない", () => {
    const { container } = render(
      <MdastRenderer node={md("https://example.com/a\n")} />,
    );

    expect(container.querySelector(":scope a.link-card")).toBeNull();
    expect(container.querySelector(":scope p a")?.getAttribute("href")).toBe(
      "https://example.com/a",
    );
  });

  it("リスト項目の中はカードにしない", () => {
    const { container } = render(
      <MdastRenderer
        node={md("- https://example.com/a\n")}
        linkCards={cards}
      />,
    );

    expect(container.querySelector(":scope a.link-card")).toBeNull();
    expect(container.querySelector(":scope li a")?.getAttribute("href")).toBe(
      "https://example.com/a",
    );
  });

  it("文章に混ざった URL はカードにしない", () => {
    const { container } = render(
      <MdastRenderer
        node={md("詳しくは https://example.com/a を見よ。\n")}
        linkCards={cards}
      />,
    );

    expect(container.querySelector(":scope a.link-card")).toBeNull();
    expect(container.querySelector(":scope p")?.textContent).toContain(
      "詳しくは",
    );
  });

  it("カードと通常の段落が混ざっても順序を保つ", () => {
    const { container } = render(
      <MdastRenderer
        node={md("まえがき\n\nhttps://example.com/a\n\nあとがき\n")}
        linkCards={cards}
      />,
    );

    const texts = [
      ...container.querySelectorAll(":scope p, :scope a.link-card"),
    ].map((element) => element.textContent);
    expect(texts[0]).toBe("まえがき");
    expect(texts[1]).toContain("カードの題");
    expect(texts[2]).toBe("あとがき");
  });

  it("画像も favicon も無いカードは絵を出さない", () => {
    const bare: LinkCardMap = {
      "https://example.com/a": {
        ...cards["https://example.com/a"],
        imageUrl: null,
        faviconUrl: null,
      },
    };

    const { container } = render(
      <MdastRenderer node={md("https://example.com/a\n")} linkCards={bare} />,
    );

    expect(container.querySelectorAll(":scope a.link-card img")).toHaveLength(
      0,
    );
    expect(
      container.querySelector(":scope a.link-card")?.textContent,
    ).toContain("カードの題");
  });

  it("本文に link-card と書かれても要素にはならない", () => {
    // 生 HTML は keepEmbedHtml が iframe 以外を落とす。印を外から差し込めないことを固定する。
    const { container } = render(
      <MdastRenderer
        node={md('<link-card url="https://example.com/a"></link-card>\n')}
        linkCards={cards}
      />,
    );

    expect(container.querySelector(":scope a.link-card")).toBeNull();
  });
});
