import { describe, expect, it } from "vitest";
import { extractSummary, parseNoteContent } from "./note-content-parser";

const withFrontmatter = `---
title: My Note
imageUrl: ./cover.png
publishedOn: 2026-01-15
lastModifiedOn: 2026-01-20
---

# Heading

First paragraph body.

Second paragraph.
`;

describe("parseNoteContent", () => {
  it("extracts frontmatter fields", () => {
    const { frontmatter } = parseNoteContent(withFrontmatter);
    expect(frontmatter).toEqual({
      title: "My Note",
      imageUrl: "./cover.png",
      publishedOn: "2026-01-15",
      lastModifiedOn: "2026-01-20",
    });
  });

  it("parses the body (without frontmatter) into MDAST", () => {
    const { mdast } = parseNoteContent(withFrontmatter);
    // 先頭は yaml ノードではなく heading (フロントマターは除去済み)。
    expect(mdast.children.at(0)?.type).toBe("heading");
  });

  it("derives a summary from body text, skipping headings", () => {
    const { summary } = parseNoteContent(withFrontmatter);
    expect(summary.startsWith("First paragraph body.")).toBe(true);
    expect(summary).not.toContain("Heading");
  });

  it("returns undefined frontmatter fields when absent", () => {
    const { frontmatter } = parseNoteContent("# Just a title\n\nBody.");
    expect(frontmatter.title).toBeUndefined();
    expect(frontmatter.publishedOn).toBeUndefined();
  });
});

describe("extractSummary", () => {
  it("caps the summary at 160 characters", () => {
    const long = "a ".repeat(200);
    const { mdast } = parseNoteContent(long);
    expect(extractSummary(mdast).length).toBeLessThanOrEqual(160);
  });

  it("skips code blocks and footnote definitions", () => {
    const { mdast } = parseNoteContent(
      "```ts\nconst x = 1;\n```\n\nProse text here.\n",
    );
    expect(extractSummary(mdast)).toBe("Prose text here.");
  });
});
