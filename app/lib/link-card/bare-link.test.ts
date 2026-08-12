import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { collectBareLinkParagraphs, collectBareLinkUrls } from "./bare-link";
import type { Root } from "mdast";

const processor = unified().use(remarkParse).use(remarkGfm);

function parse(markdown: string): Root {
  return processor.parse(markdown);
}

describe("collectBareLinkUrls", () => {
  it("むき出しの URL だけの段落を拾う", () => {
    const urls = collectBareLinkUrls(parse("https://example.com/a\n"));
    expect(urls).toEqual(["https://example.com/a"]);
  });

  it("山括弧で囲んだ autolink も拾う", () => {
    const urls = collectBareLinkUrls(parse("<https://example.com/a>\n"));
    expect(urls).toEqual(["https://example.com/a"]);
  });

  it("スキームを省いた autolink も拾う", () => {
    // GFM は www 始まりを拾い、url にだけ http:// を足す (https ではない)。
    // eslint-disable-next-line unicorn/prefer-https -- remark-gfm が実際に出す文字列。https に直すと期待値が嘘になる
    const expected = "http://www.example.com";
    const urls = collectBareLinkUrls(parse("www.example.com\n"));
    expect(urls).toEqual([expected]);
  });

  it("文章に混ざった URL は拾わない", () => {
    const urls = collectBareLinkUrls(
      parse("詳しくは https://example.com/a を見よ。\n"),
    );
    expect(urls).toEqual([]);
  });

  it("文字列がリンク先と違うリンクは拾わない", () => {
    const urls = collectBareLinkUrls(
      parse("[Example](https://example.com/a)\n"),
    );
    expect(urls).toEqual([]);
  });

  it("リンクが 2 つ並んだ段落は拾わない", () => {
    const urls = collectBareLinkUrls(
      parse("https://example.com/a https://example.com/b\n"),
    );
    expect(urls).toEqual([]);
  });

  it("リスト項目の中は拾わない", () => {
    const urls = collectBareLinkUrls(
      parse("- https://example.com/a\n- https://example.com/b\n"),
    );
    expect(urls).toEqual([]);
  });

  it("入れ子のリスト項目の中も拾わない", () => {
    const urls = collectBareLinkUrls(
      parse("- 見よ\n\n  - https://example.com/a\n"),
    );
    expect(urls).toEqual([]);
  });

  it("脚注の中は拾わない", () => {
    const urls = collectBareLinkUrls(
      parse("本文[^1]\n\n[^1]: https://example.com/a\n"),
    );
    expect(urls).toEqual([]);
  });

  it("引用の中は拾う", () => {
    const urls = collectBareLinkUrls(parse("> https://example.com/a\n"));
    expect(urls).toEqual(["https://example.com/a"]);
  });

  it("http / https 以外は拾わない", () => {
    const urls = collectBareLinkUrls(parse("<mailto:foo@example.com>\n"));
    expect(urls).toEqual([]);
  });

  it("同じ URL は 1 つにまとめる", () => {
    const urls = collectBareLinkUrls(
      parse("https://example.com/a\n\nhttps://example.com/a\n"),
    );
    expect(urls).toEqual(["https://example.com/a"]);
  });

  it("定義順を保つ", () => {
    const urls = collectBareLinkUrls(
      parse("https://example.com/b\n\nhttps://example.com/a\n"),
    );
    expect(urls).toEqual(["https://example.com/b", "https://example.com/a"]);
  });
});

describe("collectBareLinkParagraphs", () => {
  it("木の中の段落ノードそのものを返す", () => {
    const root = parse("https://example.com/a\n");
    const [found] = collectBareLinkParagraphs(root);
    const [firstBlock] = root.children;
    expect(found.paragraph).toBe(firstBlock);
  });

  it("カード化する段落だけを返す", () => {
    const root = parse(
      "はじめに\n\nhttps://example.com/a\n\n- https://example.com/b\n",
    );
    const found = collectBareLinkParagraphs(root);
    expect(found.map(({ url }) => url)).toEqual(["https://example.com/a"]);
  });
});
