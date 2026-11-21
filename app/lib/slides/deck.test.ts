import { describe, expect, it } from "vitest";
import { footnoteNumbers, paginate, titleTextOf, withoutPauses } from "./deck";
import { findOverfull } from "./overfull";
import { SAMPLE_SLIDE_MARKDOWN } from "./sample-deck";
import type { ContentPage, SlideDeck, SlidePage } from "./deck";
import type { Image, Root } from "mdast";
import { parseMarkdownBody } from "~/backend/services/markdown-body";
import { mapTree } from "~/backend/services/mdast-tree";

function deckOf(markdown: string): SlideDeck {
  return paginate(parseMarkdownBody(markdown).mdast);
}

/** 同期が画像に埋める寸法を、ここでも埋める (縦横比で置き方が決まるため)。 */
function withImageSize(mdast: Root, width: number, height: number): Root {
  return mapTree(mdast, (node) =>
    node.type === "image"
      ? ({ ...node, data: { hProperties: { width, height } } } satisfies Image)
      : node,
  );
}

function contentPages(deck: SlideDeck): readonly ContentPage[] {
  return deck.pages.filter((page): page is ContentPage => page.kind === "content");
}

function pageTitled(deck: SlideDeck, title: string): ContentPage {
  const page = contentPages(deck).find((each) => titleTextOf(each) === title);
  if (page === undefined) throw new Error(`no page titled ${title}`);
  return page;
}

describe("paginate: 見本のデッキ", () => {
  const deck = deckOf(SAMPLE_SLIDE_MARKDOWN);

  it("cuts the source into a cover, chapters, pages and references", () => {
    expect(deck.pages.map((page: SlidePage) => `${page.kind}:${titleTextOf(page)}`)).toEqual([
      "cover:",
      "chapter:動機",
      "content:なぜ自作するのか",
      "content:自分の言葉を、自分の場所から",
      "chapter:構成",
      "content:全体像",
      "content:同期の流れ",
      "content:置き場所の比較",
      "content:設計の拠り所",
      "content:入口のコード",
      "content:人気順の重み",
      "content:同期のしくみ",
      "content:使っているもの",
      "content:ご清聴ありがとうございました",
      "references:",
    ]);
    expect(deck.chapters).toBe(2);
  });

  /* 地の文は語り。スライドには出さず、そのページの発表者ノートに付ける。 */
  it("keeps narration out of the page and attaches it as notes", () => {
    const [cover, chapter] = deck.pages;
    expect(cover?.kind === "cover" && cover.notes).toHaveLength(1);
    expect(chapter?.kind === "chapter" && chapter.notes).toHaveLength(1);

    const page = pageTitled(deck, "なぜ自作するのか");
    expect(page.blocks.map((block) => block.node.type)).toEqual(["list"]);
    expect(page.notes).toHaveLength(1);
  });

  it("numbers the chapter each page belongs to", () => {
    expect(pageTitled(deck, "なぜ自作するのか").chapter).toBe(1);
    expect(pageTitled(deck, "全体像").chapter).toBe(2);
  });

  it.each([
    ["自分の言葉を、自分の場所から", "statement"],
    ["置き場所の比較", "table"],
    ["設計の拠り所", "quote"],
    ["入口のコード", "body"],
    ["なぜ自作するのか", "body"],
  ])("lays out 「%s」 as %s", (title, layout) => {
    expect(pageTitled(deck, title).layout).toBe(layout);
  });

  /*
   * 番号付きリストは 1 項目ずつ出す。「間」(`. . .`) はその先を 1 段遅らせる。
   * Alert は引用から組んだ別の塊で、大きな引用としては扱わない。
   */
  it("reveals ordered items one by one and pauses at `. . .`", () => {
    const page = pageTitled(deck, "同期の流れ");

    expect(page.blocks.map((block) => [block.node.type, block.step, block.itemSteps])).toEqual([
      ["list", 0, [0, 1, 2]],
      ["blockquote", 3, undefined],
    ]);
    expect(page.lastStep).toBe(3);
    expect(page.layout).toBe("body");
  });

  it("collects footnotes into the references page", () => {
    const references = deck.pages.at(-1);
    expect(references?.kind === "references" && references.footnotes).toHaveLength(1);
  });

  it("returns the same deck for the same source", () => {
    expect(deckOf(SAMPLE_SLIDE_MARKDOWN)).toEqual(deck);
  });
});

describe("paginate: 図の置き方は縦横比で決まる", () => {
  const withFigure = "## 構成\n\n![構成図](./a.png)\n\n- 1 つ目\n";

  it("stacks a landscape figure over the rest", () => {
    const mdast = withImageSize(parseMarkdownBody(withFigure).mdast, 1600, 900);
    const page = contentPages(paginate(mdast))[0];

    expect(page?.layout).toBe("figure-over");
    expect(page?.figure?.node.type).toBe("paragraph");
    // 図は塊の並びから外れる (置き場所が別なので)。
    expect(page?.blocks.map((block) => block.node.type)).toEqual(["list"]);
  });

  it("puts a portrait figure beside the rest", () => {
    const mdast = withImageSize(parseMarkdownBody(withFigure).mdast, 780, 1688);
    expect(contentPages(paginate(mdast))[0]?.layout).toBe("figure-beside");
  });

  /* 寸法が読めなかった図は横長として扱う (上下に積むほうが収まりやすい)。 */
  it("treats a figure of unknown size as landscape", () => {
    expect(contentPages(deckOf(withFigure))[0]?.layout).toBe("figure-over");
  });

  it("fills the page with a lone figure", () => {
    expect(contentPages(deckOf("## 構成\n\n![構成図](./a.png)\n"))[0]?.layout).toBe("figure");
  });

  /* 図が 2 つ以上あるときは主役を決められないので、上から順に並べる。 */
  it("does not single out a figure when there are several", () => {
    const page = contentPages(deckOf("## 比べる\n\n![前](./a.png)\n\n![後](./b.png)\n"))[0];
    expect(page?.layout).toBe("body");
    expect(page?.figure).toBeNull();
    expect(page?.blocks).toHaveLength(2);
  });

  /* 画像のほかに字のある段落は図ではなく語り。 */
  it("does not treat a paragraph with text around an image as a figure", () => {
    const page = contentPages(deckOf("## 構成\n\n図は ![構成図](./a.png) のとおり。\n"))[0];
    expect(page?.layout).toBe("statement");
    expect(page?.notes).toHaveLength(1);
  });
});

describe("paginate: 書いたものを黙って捨てない", () => {
  /* 表紙と章の扉は塊を持てない。そこに書いた塊は、題の無いページを起こして載せる。 */
  it("opens an untitled page for blocks written before any page heading", () => {
    const deck = deckOf("- 先に書いた列挙\n\n# 章\n\n- 扉の直後の列挙\n");

    expect(deck.pages.map((page) => page.kind)).toEqual(["cover", "content", "chapter", "content"]);
    expect(contentPages(deck).map((page) => titleTextOf(page))).toEqual(["", ""]);
  });

  /* 生の HTML は見た目の逃げ道になるので運ばない。区切り線はページを切らない。 */
  it("drops raw HTML and thematic breaks", () => {
    const page = contentPages(deckOf("## 題\n\n<div class='big'>x</div>\n\n---\n\n- 列挙\n"))[0];
    expect(page?.blocks.map((block) => block.node.type)).toEqual(["list"]);
  });

  /* `###` より深い見出しはページを切らず、ページの中の小見出しになる。 */
  it("keeps deeper headings inside the page", () => {
    const page = contentPages(deckOf("## 題\n\n### 小見出し\n\n- 列挙\n"))[0];
    expect(page?.blocks.map((block) => block.node.type)).toEqual(["heading", "list"]);
  });

  it("keeps link reference definitions for every page", () => {
    const deck = deckOf("## 題\n\n- [サイト][site]\n\n[site]: https://example.com/\n");
    expect(deck.definitions.map((definition) => definition.url)).toEqual(["https://example.com/"]);
  });
});

describe("findOverfull", () => {
  const items = (count: number, text = "項目"): string =>
    Array.from({ length: count }, (_, index) => `- ${text} ${String(index)}`).join("\n");
  const code = (lines: number): string =>
    ["```ts", ...Array.from({ length: lines }, () => "const a = 1;"), "```"].join("\n");

  it("finds nothing in the sample deck", () => {
    expect(findOverfull(deckOf(SAMPLE_SLIDE_MARKDOWN))).toEqual([]);
  });

  /* 数は、テーマの字の大きさで実物を測って決めた上限。ちょうどは通り、1 つ超えると出る。 */
  it("reports the page number and what overflows", () => {
    const deck = deckOf(
      `## 入る\n\n${items(7)}\n\n## 列挙が多い\n\n${items(8)}\n\n## 入る\n\n${code(9)}\n\n## コードが長い\n\n${code(10)}\n`,
    );

    expect(findOverfull(deck)).toEqual([
      { page: 3, reason: "8 list items (at most 7)" },
      { page: 5, reason: "10 lines of code (at most 9)" },
    ]);
  });

  /* 項目の数が少なくても、1 項目が長ければ折り返して入らなくなる。行数で見積もる。 */
  it("estimates wrapped lines, not only the number of items", () => {
    const long = "あ".repeat(40);

    expect(findOverfull(deckOf(`## 題\n\n${items(4, long)}\n`))).toEqual([]);
    expect(findOverfull(deckOf(`## 題\n\n${items(5, long)}\n`))).toEqual([
      { page: 2, reason: "10 lines of text (at most 8)" },
    ]);
  });

  /*
   * 横長の図の下に積むページは、下に置く量が増えるほど図が小さくなる。図が読める大きさで
   * 残る量に抑える。縦長の図の横に並べるページは高さを使えるので、もう少し置ける。
   */
  it("is stricter on a page that shares the space with a figure", () => {
    const under = `## 題\n\n![図](./a.png)\n\n${items(4)}\n`;
    expect(findOverfull(deckOf(under))).toEqual([
      { page: 2, reason: "4 list items (at most 3)" },
      { page: 2, reason: "4 lines of text (at most 3)" },
    ]);

    const beside = withImageSize(parseMarkdownBody(under).mdast, 780, 1688);
    expect(findOverfull(paginate(beside))).toEqual([]);
  });

  it("counts nested list items and table size", () => {
    const nested = `- 親\n${Array.from({ length: 7 }, (_, index) => `  - 子 ${String(index)}`).join("\n")}\n`;
    const table = `| a | b | c | d | e | f |\n| - | - | - | - | - | - |\n| 1 | 2 | 3 | 4 | 5 | 6 |\n`;
    const deck = deckOf(`## 入れ子\n\n${nested}\n## 表\n\n${table}`);

    expect(findOverfull(deck)).toEqual([
      { page: 2, reason: "8 list items (at most 7)" },
      { page: 3, reason: "6 table columns (at most 5)" },
    ]);
  });

  it("flags a title too long to stay on two lines", () => {
    expect(findOverfull(deckOf(`## ${"題".repeat(33)}\n`))).toEqual([
      { page: 2, reason: "33 characters in the title (at most 32)" },
    ]);
  });
});

describe("withoutPauses / footnoteNumbers", () => {
  /* 間はスライドの時間の話。読み物に `. . .` を字として出さない。 */
  it("drops pause markers for the reading view and keeps everything else", () => {
    const mdast = parseMarkdownBody("## 題\n\n- 前\n\n. . .\n\n- 後\n\n語り。\n").mdast;
    const reading = withoutPauses(mdast);

    expect(reading.children.map((node) => node.type)).toEqual([
      "heading",
      "list",
      "list",
      "paragraph",
    ]);
    // 元の木は変えない。
    expect(mdast.children).toHaveLength(5);
  });

  it("numbers footnotes in the order of the references page", () => {
    const deck = deckOf("## 題\n\n- 一[^b]\n- 二[^a]\n\n[^a]: A\n[^b]: B\n");
    expect([...footnoteNumbers(deck)]).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });
});

describe("間 (`. . .`) の置き場所", () => {
  /* 表紙や章の扉の直後に書いた間で、題も中身も無いページを起こさない。 */
  it("does not open a page for a pause written before any page", () => {
    const deck = deckOf(". . .\n\n# 章\n\n. . .\n\n## 題\n\n- 列挙\n");
    expect(deck.pages.map((page) => page.kind)).toEqual(["cover", "chapter", "content"]);
  });

  /* ページの末尾に書いた間は、その先に出すものが無い。何も出ない空送りを作らない。 */
  it("does not add an empty step for a trailing pause", () => {
    const page = contentPages(deckOf("## 題\n\n- 前\n\n. . .\n\n- 後\n\n. . .\n"))[0];
    expect(page?.blocks.map((block) => block.step)).toEqual([0, 1]);
    expect(page?.lastStep).toBe(1);
  });
});

describe("findOverfull: 置き方ごとの目安", () => {
  /* 引用だけのページは字を大きく出すので、入る量が少ない。 */
  it("is stricter on a page that shows a lone quote in large type", () => {
    const quote = (characters: number): string => `## 題\n\n> ${"あ".repeat(characters)}\n`;

    expect(findOverfull(deckOf(quote(100)))).toEqual([]);
    expect(findOverfull(deckOf(quote(101)))).toEqual([
      { page: 2, reason: "6 lines of text (at most 5)" },
    ]);
  });

  /* Mermaid は図に組まれる。ソースの行数をコードの行数として数えない。 */
  it("does not count the source lines of a diagram as code", () => {
    const source = Array.from({ length: 20 }, (_, index) => `  a${String(index)} --> b`).join("\n");
    expect(
      findOverfull(deckOf(`## 図\n\n\`\`\`mermaid\nflowchart LR\n${source}\n\`\`\`\n`)),
    ).toEqual([]);
  });
});
