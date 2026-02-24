import { describe, expect, it } from "vitest";
import { highlightCodeBlocks } from "./highlight-code";
import type { Code, Root } from "mdast";

const getHastData = (code: Code): unknown =>
  (code.data as Record<string, unknown> | undefined)?.hast;

describe("highlightCodeBlocks", () => {
  it("言語指定のあるコードブロックに data.hast を付与する", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "code",
          lang: "typescript",
          value: "const x = 1;",
        },
      ],
    };

    const result = highlightCodeBlocks(tree);

    const code = result.children[0] as Code;
    expect(code.data).toBeDefined();
    expect(getHastData(code)).toBeDefined();
  });

  it("言語指定のないコードブロックは変換しない", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "code",
          lang: null,
          value: "plain text",
        },
      ],
    };

    const result = highlightCodeBlocks(tree);

    const code = result.children[0] as Code;
    expect(getHastData(code)).toBeUndefined();
  });

  it("未対応の言語のコードブロックは変換しない", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "code",
          lang: "brainfuck",
          value: "++++[>++++<-]>.",
        },
      ],
    };

    const result = highlightCodeBlocks(tree);

    const code = result.children[0] as Code;
    expect(getHastData(code)).toBeUndefined();
  });

  it("元のツリーを変更しない（非破壊）", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "code",
          lang: "typescript",
          value: "const x = 1;",
        },
      ],
    };

    const result = highlightCodeBlocks(tree);

    const originalCode = tree.children[0] as Code;
    expect(originalCode.data).toBeUndefined();
    expect(result).not.toBe(tree);
  });

  it("blockquote 内のコードブロックをハイライトする", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "blockquote",
          children: [
            {
              type: "code",
              lang: "typescript",
              value: "const x = 1;",
            },
          ],
        },
      ],
    };

    const result = highlightCodeBlocks(tree);

    const blockquote = result.children[0];
    expect(blockquote.type).toBe("blockquote");
    const code = (blockquote as { children: Code[] }).children[0];
    expect(getHastData(code)).toBeDefined();
  });

  it("list item 内のコードブロックをハイライトする", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "list",
          ordered: false,
          children: [
            {
              type: "listItem",
              children: [
                {
                  type: "code",
                  lang: "typescript",
                  value: "const x = 1;",
                },
              ],
            },
          ],
        },
      ],
    };

    const result = highlightCodeBlocks(tree);

    const list = result.children[0] as { children: { children: Code[] }[] };
    const code = list.children[0].children[0];
    expect(getHastData(code)).toBeDefined();
  });

  it("コードブロック以外のノードはそのまま保持する", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "heading",
          depth: 2,
          children: [{ type: "text", value: "Title" }],
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "Body" }],
        },
        {
          type: "code",
          lang: "css",
          value: "body { color: red; }",
        },
      ],
    };

    const result = highlightCodeBlocks(tree);

    expect(result.children[0].type).toBe("heading");
    expect(result.children[1].type).toBe("paragraph");
    expect(result.children[2].type).toBe("code");
    expect(getHastData(result.children[2] as Code)).toBeDefined();
  });
});
