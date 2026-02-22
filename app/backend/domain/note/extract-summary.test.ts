import { describe, expect, it } from "vitest";
import { extractSummary } from "./extract-summary";
import type { Root } from "mdast";

const createTextTree = (paragraphs: string[]): Root => ({
  type: "root",
  children: paragraphs.map((text) => ({
    type: "paragraph",
    children: [{ type: "text", value: text }],
  })),
});

describe("extractSummary", () => {
  it("extracts text from paragraph nodes", () => {
    const tree = createTextTree(["Hello world."]);
    expect(extractSummary(tree)).toBe("Hello world.");
  });

  it("joins text from multiple paragraphs", () => {
    const tree = createTextTree(["First paragraph.", "Second paragraph."]);
    expect(extractSummary(tree)).toBe("First paragraph. Second paragraph.");
  });

  it("truncates text exceeding maxLength with ellipsis", () => {
    const tree = createTextTree(["A".repeat(200)]);
    const result = extractSummary(tree, 50);
    expect(result).toBe("A".repeat(50) + "...");
  });

  it("returns full text when within maxLength", () => {
    const tree = createTextTree(["Short text."]);
    expect(extractSummary(tree, 50)).toBe("Short text.");
  });

  it("collapses whitespace", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "Hello   \n  world" }],
        },
      ],
    };
    expect(extractSummary(tree)).toBe("Hello world");
  });

  it("returns empty string for tree with no text", () => {
    const tree: Root = { type: "root", children: [] };
    expect(extractSummary(tree)).toBe("");
  });

  it("ignores heading nodes", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "heading",
          depth: 1,
          children: [{ type: "text", value: "Article Title" }],
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "Body text here." }],
        },
      ],
    };
    expect(extractSummary(tree)).toBe("Body text here.");
  });

  it("ignores all heading depths", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "heading",
          depth: 1,
          children: [{ type: "text", value: "H1 Title" }],
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "Intro." }],
        },
        {
          type: "heading",
          depth: 2,
          children: [{ type: "text", value: "H2 Section" }],
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "Section content." }],
        },
      ],
    };
    expect(extractSummary(tree)).toBe("Intro. Section content.");
  });

  it("ignores non-text nodes like images and code blocks", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Before image." },
            { type: "image", url: "test.png", alt: "alt text" },
          ],
        },
        { type: "code", value: "const x = 1;", lang: "ts" },
        {
          type: "paragraph",
          children: [{ type: "text", value: "After code." }],
        },
      ],
    };
    expect(extractSummary(tree)).toBe("Before image. After code.");
  });
});
