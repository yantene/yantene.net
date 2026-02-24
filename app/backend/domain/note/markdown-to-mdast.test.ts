import { describe, expect, it } from "vitest";
import { markdownToMdast } from "./markdown-to-mdast";
import { NoteSlug } from "./note-slug.vo";
import type {
  Delete,
  FootnoteDefinition,
  FootnoteReference,
  Image,
  Paragraph,
  Root,
  Table,
} from "mdast";

const slug = NoteSlug.create("my-article");

describe("markdownToMdast", () => {
  it("Markdown 文字列を mdast Root ノードに変換する", () => {
    const content = `# Hello

This is a paragraph.
`;

    const result = markdownToMdast(content, slug);

    expect(result.type).toBe("root");
    expect(result.children.length).toBeGreaterThan(0);
    expect(result.children[0].type).toBe("heading");
  });

  it("frontmatter (YAML ノード) を除去する", () => {
    const content = `---
title: "My Article"
publishedOn: "2026-01-15"
---

# Hello

Paragraph text.
`;

    const result = markdownToMdast(content, slug);

    const hasYamlNode = result.children.some((child) => child.type === "yaml");
    expect(hasYamlNode).toBe(false);

    expect(result.children[0].type).toBe("heading");
  });

  it("空の Markdown を処理して空の Root ノードを返す", () => {
    const content = "";

    const result = markdownToMdast(content, slug);

    expect(result.type).toBe("root");
    expect(result.children).toEqual([]);
  });

  it("mdast Root ノードの type が 'root' である", () => {
    const content = "Some text.";

    const result: Root = markdownToMdast(content, slug);

    expect(result.type).toBe("root");
  });

  it("相対画像パスをアセット配信 API の URL に変換する", () => {
    const content = `# Article

![Diagram](images/diagram.png)
`;

    const result = markdownToMdast(content, slug);

    const paragraph = result.children.find(
      (child) => child.type === "paragraph",
    ) as Paragraph;
    expect(paragraph).toBeDefined();

    const image = paragraph.children.find(
      (child) => child.type === "image",
    ) as Image;
    expect(image).toBeDefined();
    expect(image.url).toBe(
      "/api/v1/notes/my-article/assets/images/diagram.png",
    );
  });

  it("絶対 URL の画像はそのまま保持する", () => {
    const content = `![Photo](https://example.com/photo.jpg)`;

    const result = markdownToMdast(content, slug);

    const paragraph = result.children[0] as Paragraph;
    const image = paragraph.children[0] as Image;
    expect(image.url).toBe("https://example.com/photo.jpg");
  });

  it("frontmatter のみの Markdown を処理する", () => {
    const content = `---
title: "Only frontmatter"
---
`;

    const result = markdownToMdast(content, slug);

    expect(result.type).toBe("root");
    const hasYamlNode = result.children.some((child) => child.type === "yaml");
    expect(hasYamlNode).toBe(false);
  });

  it("コードブロックや他のノードタイプを正しくパースする", () => {
    const content = `# Heading

Some text with **bold** and *italic*.

- Item 1
- Item 2
`;

    const result = markdownToMdast(content, slug);

    const types = result.children.map((child) => child.type);
    expect(types).toContain("heading");
    expect(types).toContain("paragraph");
    expect(types).toContain("list");
  });

  it("GFM テーブルを table/tableRow/tableCell ノードにパースする", () => {
    const content = `| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |
`;

    const result = markdownToMdast(content, slug);

    const table = result.children[0] as Table;
    expect(table.type).toBe("table");
    expect(table.children).toHaveLength(2);

    const headerRow = table.children[0];
    expect(headerRow.type).toBe("tableRow");

    const headerCell = headerRow.children[0];
    expect(headerCell.type).toBe("tableCell");
  });

  it("GFM テーブルのアラインメント情報を保持する", () => {
    const content = `| Left | Center | Right |
| :--- | :---: | ---: |
| a | b | c |
`;

    const result = markdownToMdast(content, slug);

    const table = result.children[0] as Table;
    expect(table.align).toEqual(["left", "center", "right"]);
  });

  it("GFM 取り消し線を delete ノードにパースする", () => {
    const content = `This is ~~deleted~~ text.`;

    const result = markdownToMdast(content, slug);

    const paragraph = result.children[0] as Paragraph;
    const deleteNode = paragraph.children.find(
      (child) => child.type === "delete",
    ) as Delete;
    expect(deleteNode).toBeDefined();
    expect(deleteNode.type).toBe("delete");
  });

  it("GFM 脚注を footnoteReference と footnoteDefinition にパースする", () => {
    const content = `Text with a footnote[^1].

[^1]: This is the footnote content.
`;

    const result = markdownToMdast(content, slug);

    const paragraph = result.children[0] as Paragraph;
    const ref = paragraph.children.find(
      (child) => child.type === "footnoteReference",
    ) as FootnoteReference;
    expect(ref).toBeDefined();
    expect(ref.identifier).toBe("1");

    const def = result.children.find(
      (child) => child.type === "footnoteDefinition",
    ) as FootnoteDefinition;
    expect(def).toBeDefined();
    expect(def.identifier).toBe("1");
  });
});
