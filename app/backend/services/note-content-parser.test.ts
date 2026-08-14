import { toString as mdastToString } from "mdast-util-to-string";
import { describe, expect, it } from "vitest";
import { MathSyntaxError } from "./latex-to-mathml";
import { extractSummary, parseNoteContent } from "./note-content-parser";
import type { ParsedNoteContent } from "./note-content-parser";

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

  /*
   * 数式ノードは value に LaTeX 原文を持つ。要約に混ぜると `\frac{a}{b}` のような
   * 制御綴りが一覧や OGP にそのまま出るので、生 HTML と同じく除く。
   */
  it("drops the LaTeX source of inline math but keeps the prose around it", () => {
    const { mdast } = parseNoteContent(
      "解の公式は $\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ である。\n",
    );
    expect(extractSummary(mdast)).toBe("解の公式は である。");
  });

  it("drops display math blocks entirely", () => {
    const { mdast } = parseNoteContent("$$\n\\frac{a}{b}\n$$\n\n本文。\n");
    expect(extractSummary(mdast)).toBe("本文。");
  });
});

describe("math", () => {
  it("turns $...$ into an inlineMath node carrying MathML", () => {
    const { mdast } = parseNoteContent("式 $a^2$ です。\n");
    const paragraph = mdast.children.at(0);
    const math =
      paragraph?.type === "paragraph"
        ? paragraph.children.find((child) => child.type === "inlineMath")
        : undefined;
    expect(math?.data?.hName).toBe("math");
    expect(math?.data?.hProperties?.xmlns).toBe(
      "http://www.w3.org/1998/Math/MathML",
    );
    expect(math?.data?.hChildren?.at(0)).toMatchObject({
      type: "element",
      tagName: "semantics",
    });
  });

  it("turns $$...$$ into a display math node", () => {
    const { mdast } = parseNoteContent("$$\na^2\n$$\n");
    const math = mdast.children.at(0);
    expect(math?.type).toBe("math");
    expect(math?.data?.hName).toBe("math");
    expect(math?.data?.hProperties?.display).toBe("block");
  });

  /* 既定の hName は code / pre。上書きし損ねると数式が LaTeX のまま出る。 */
  it("replaces the code fallback that remark-math sets by default", () => {
    const { mdast } = parseNoteContent("$$\na^2\n$$\n");
    expect(mdast.children.at(0)?.data?.hChildren).not.toMatchObject([
      { tagName: "code" },
    ]);
  });

  it("leaves math inside inline code alone", () => {
    const { mdast } = parseNoteContent("記法は `$a$` と書く。\n");
    const paragraph = mdast.children.at(0);
    const kinds =
      paragraph?.type === "paragraph"
        ? paragraph.children.map((child) => child.type)
        : [];
    expect(kinds).not.toContain("inlineMath");
  });

  it("throws MathSyntaxError so refresh can skip the note", () => {
    expect(() => parseNoteContent("壊れた式 $\\frac{$ です。\n")).toThrow(
      MathSyntaxError,
    );
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

describe("GFM alerts", () => {
  const parseBody = (body: string): ParsedNoteContent =>
    parseNoteContent(`---\ntitle: T\n---\n\n${body}`);

  it("引用の冒頭のラベルを種別として取り出し、ラベル行は本文に残さない", () => {
    const { mdast } = parseBody("> [!NOTE]\n> 補足の本文。\n");
    const alert = mdast.children.at(0);

    expect(alert?.type).toBe("blockquote");
    expect(alert?.data).toMatchObject({
      hName: "markdown-alert",
      hProperties: { kind: "note" },
    });
    expect(mdastToString(mdast)).toBe("補足の本文。");
  });

  it.each([
    ["NOTE", "note"],
    ["TIP", "tip"],
    ["IMPORTANT", "important"],
    ["WARNING", "warning"],
    ["CAUTION", "caution"],
  ])("%s を %s として扱う", (label, kind) => {
    const { mdast } = parseBody(`> [!${label}]\n> 本文。\n`);
    expect(mdast.children.at(0)?.data).toMatchObject({
      hProperties: { kind },
    });
  });

  it("ラベルの大文字小文字を問わない", () => {
    const { mdast } = parseBody("> [!Warning]\n> 本文。\n");
    expect(mdast.children.at(0)?.data).toMatchObject({
      hProperties: { kind: "warning" },
    });
  });

  it("ラベルだけの引用は中身を空にする", () => {
    const { mdast } = parseBody("> [!NOTE]\n");
    const alert = mdast.children.at(0);

    expect(alert?.data).toMatchObject({ hProperties: { kind: "note" } });
    expect(alert?.type === "blockquote" && alert.children).toEqual([]);
  });

  it("ラベルを含む引用でも、段落の途中に現れたものは本文として扱う", () => {
    const { mdast } = parseBody("> 前置き [!NOTE]\n> 本文。\n");
    const quote = mdast.children.at(0);

    expect(quote?.type).toBe("blockquote");
    expect(quote?.data).toBeUndefined();
    expect(mdastToString(mdast)).toContain("[!NOTE]");
  });

  it("知らないラベルは引用のままにする", () => {
    const { mdast } = parseBody("> [!HINT]\n> 本文。\n");
    expect(mdast.children.at(0)?.data).toBeUndefined();
  });

  it("ラベル行に続く強調などの装飾を落とさない", () => {
    const { mdast } = parseBody("> [!TIP]\n> **強調**した本文。\n");
    expect(mdastToString(mdast)).toBe("強調した本文。");
  });
});

describe("要約と Alert", () => {
  it("記事の頭に置いた Alert を要約に数えない", () => {
    const { summary } = parseNoteContent(
      `---\ntitle: T\n---\n\n> [!WARNING]\n> リンク先は消えました。\n\n本題はここから始まる。\n`,
    );
    expect(summary).toBe("本題はここから始まる。");
  });

  it("ラベルの無い引用は本文として要約に数える", () => {
    const { summary } = parseNoteContent(
      `---\ntitle: T\n---\n\n> 引用は本文の一部。\n\n続きの段落。\n`,
    );
    expect(summary).toBe("引用は本文の一部。 続きの段落。");
  });
});
