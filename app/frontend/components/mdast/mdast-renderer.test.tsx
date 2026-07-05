import { render } from "@testing-library/react";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { MdastRenderer } from "./mdast-renderer";
import type { Root as MdastRoot } from "mdast";

function md(markdown: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

describe("MdastRenderer", () => {
  it("renders headings with slug ids for anchor links", () => {
    const { container } = render(<MdastRenderer node={md("# Hello World")} />);
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe("Hello World");
    expect(h1?.id).toBe("hello-world");
  });

  it("renders paragraphs with emphasis, strong, and inline code", () => {
    const { container } = render(
      <MdastRenderer node={md("A **b** _c_ `d`")} />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("b");
    expect(container.querySelector("em")?.textContent).toBe("c");
    expect(container.querySelector("code")?.textContent).toBe("d");
  });

  it("highlights fenced code blocks with hljs token classes", () => {
    const { container } = render(
      <MdastRenderer node={md("```ts\nconst x = 1;\n```")} />,
    );
    const code = container.querySelector(":scope pre code");
    expect(code?.className).toContain("hljs");
    // rehype-highlight がキーワードをトークン span に分解する。
    expect(container.querySelector(".hljs-keyword")?.textContent).toBe("const");
  });

  it("does not throw on an unknown code language and still renders the text", () => {
    const { container } = render(
      <MdastRenderer node={md("```made-up-lang\nhello\n```")} />,
    );
    expect(container.querySelector(":scope pre code")?.textContent).toContain(
      "hello",
    );
  });

  it("opens external links in a new tab with a safe rel", () => {
    const { container } = render(
      <MdastRenderer node={md("[x](https://example.com)")} />,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toContain("noopener");
  });

  it("keeps internal links as plain same-tab anchors", () => {
    const { container } = render(
      <MdastRenderer node={md("[x](/notes/other)")} />,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/notes/other");
    expect(a?.getAttribute("target")).toBeNull();
  });

  it("strips dangerous URL schemes (javascript:) from links", () => {
    const { container } = render(
      <MdastRenderer node={md("[x](javascript:alert(1))")} />,
    );
    const a = container.querySelector("a");
    // rehype-sanitize が危険な href を除去する (クリックしても JS が走らない)。
    expect(a?.getAttribute("href")).toBeNull();
  });

  it("treats protocol-relative links as external (new tab + rel)", () => {
    const { container } = render(
      <MdastRenderer node={md("[x](//example.com/page)")} />,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toContain("noopener");
  });

  it("resolves image URLs through transformImageUrl and sets lazy loading", () => {
    const { container } = render(
      <MdastRenderer
        node={md("![alt](./cover.png)")}
        transformImageUrl={(src) =>
          src.replace(/^\.\//, "/api/v1/notes/x/assets/")
        }
      />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/api/v1/notes/x/assets/cover.png");
    expect(img?.getAttribute("alt")).toBe("alt");
    expect(img?.getAttribute("loading")).toBe("lazy");
  });

  it("renders GFM tables", () => {
    const { container } = render(
      <MdastRenderer node={md("| a | b |\n| - | - |\n| 1 | 2 |")} />,
    );
    expect(container.querySelectorAll("th")).toHaveLength(2);
    expect(container.querySelectorAll(":scope tbody td")).toHaveLength(2);
  });
});
