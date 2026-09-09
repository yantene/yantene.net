import { describe, expect, it } from "vitest";
import { buildEmbeddingChunks } from "./note-embedding-text";
import type { Root } from "mdast";

function paragraph(value: string): Root["children"][number] {
  return { type: "paragraph", children: [{ type: "text", value }] };
}

describe("buildEmbeddingChunks", () => {
  it("puts the title in front of the body", () => {
    const tree: Root = { type: "root", children: [paragraph("本文である")] };
    expect(buildEmbeddingChunks("題", tree, 100)).toEqual(["題\n本文である"]);
  });

  it("drops code blocks, which would outweigh the article by sheer length", () => {
    const tree: Root = {
      type: "root",
      children: [
        paragraph("説明"),
        { type: "code", lang: "sql", value: "SELECT slug FROM notes_fts" },
        paragraph("続き"),
      ],
    };
    expect(buildEmbeddingChunks("題", tree, 100)[0]).toBe("題\n説明 続き");
  });

  it("drops raw HTML and the LaTeX source of formulas", () => {
    const tree: Root = {
      type: "root",
      children: [
        { type: "html", value: "<div class='box'>" },
        paragraph("本文"),
        { type: "math", value: "\\frac{a}{b}" },
      ],
    };
    expect(buildEmbeddingChunks("題", tree, 100)[0]).toBe("題\n本文");
  });

  it("keeps inline code, which carries proper nouns such as Intl.Segmenter", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "使うのは " },
            { type: "inlineCode", value: "Intl.Segmenter" },
          ],
        },
      ],
    };
    expect(buildEmbeddingChunks("題", tree, 100)[0]).toContain("Intl.Segmenter");
  });

  it("splits an article that exceeds what the model takes in one go", () => {
    const tree: Root = { type: "root", children: [paragraph("あ".repeat(50))] };
    const chunks = buildEmbeddingChunks("題", tree, 20);
    expect(chunks.length).toBe(3);
    expect(chunks.join("")).toBe(`題\n${"あ".repeat(50)}`);
  });

  it("falls back to the title alone when the body has no text left", () => {
    const tree: Root = {
      type: "root",
      children: [{ type: "code", lang: "mermaid", value: "flowchart TD" }],
    };
    expect(buildEmbeddingChunks("図だけの記事", tree, 100)).toEqual(["図だけの記事"]);
  });
});
