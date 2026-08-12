import { toString as mdastToString } from "mdast-util-to-string";
import { describe, expect, it } from "vitest";
import { extractSummary, parseNoteContent } from "./note-content-parser";

const withFrontmatter = `---
title: My Note
imageUrl: ./cover.png
tags: [日記, プログラミング]
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
      tags: ["日記", "プログラミング"],
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

  /*
   * 古い記事には打ち消し線や囲みを生 HTML で書いたものが残っている。タグ文字列が
   * 要約に露出しないことを固定する (issue #112)。
   */
  it("drops inline raw HTML tags but keeps the text they wrap", () => {
    const { mdast } = parseNoteContent(
      "ダウンロードは<s>こちら</s> (2017年09月21日追記: データを失くしました)\n",
    );
    expect(extractSummary(mdast)).toBe(
      "ダウンロードはこちら (2017年09月21日追記: データを失くしました)",
    );
  });

  it("drops block-level raw HTML", () => {
    const { mdast } = parseNoteContent(
      "<div class='box'>\n<div>囲みの見出し</div>\n\n問題の本文。\n",
    );
    expect(extractSummary(mdast)).toBe("問題の本文。");
  });

  it("drops HTML comments", () => {
    const { mdast } = parseNoteContent(
      "<!-- 下書きメモ -->\n\n公開する本文。\n",
    );
    expect(extractSummary(mdast)).toBe("公開する本文。");
  });
});

/*
 * 日本語の原稿は文節ごとに改行して書かれていることが多い。CommonMark の既定では
 * そこに空白が 1 個入ってしまう (issue #161)。
 */
describe("collapsing soft line breaks", () => {
  const paragraphText = (markdown: string): string =>
    mdastToString(parseNoteContent(markdown).mdast);

  it("joins a break between two full-width characters", () => {
    expect(
      paragraphText("このブログに記事を書くのも、\n以来 1 年ぶりだ。\n"),
    ).toBe("このブログに記事を書くのも、以来 1 年ぶりだ。");
  });

  /* 和欧の境目の空白は表記として要るので、残す。 */
  it("keeps a break next to a latin word as a space", () => {
    expect(
      paragraphText("使っているのは\nCloudflare Workers\nである。\n"),
    ).toBe("使っているのは Cloudflare Workers である。");
  });

  /*
   * 改行はリンクや強調をまたぐと別ノードに割れる。text ノード単体では改行の向こう側の
   * 文字が分からないため、隣のノードの端まで見ないと畳めない。
   */
  it("looks across node boundaries to decide", () => {
    expect(
      paragraphText(
        "このブログに記事を書くのも、\n[昨年の記事](/notes/foo)\n以来だ。\n",
      ),
    ).toBe("このブログに記事を書くのも、昨年の記事以来だ。");
  });

  /* 畳んだ結果は要約にも効く (D1 のメタデータと OGP がこれを使う)。 */
  it("reaches the summary as well", () => {
    const { summary } = parseNoteContent(
      "日本語の文を\n文節ごとに\n改行して書く。\n",
    );
    expect(summary).toBe("日本語の文を文節ごとに改行して書く。");
  });

  /* コードブロックの改行は本文ではないので触らない。 */
  it("leaves line breaks inside code untouched", () => {
    const { mdast } = parseNoteContent("```\n日本語\n改行\n```\n");
    expect(mdastToString(mdast)).toBe("日本語\n改行");
  });
});
