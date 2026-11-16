import { toString as mdastToString } from "mdast-util-to-string";
import type { ContentPage, SlideDeck, SlideLayout } from "./deck";
import type { RootContent } from "mdast";

/*
 * 1 ページに入りきらない量を見つける (ADR 0052)。
 *
 * **入りきらないものを縮めて押し込まない。** LaTeX の Overfull \hbox と同じ考え方で、
 * 同期の結果に警告として出し、直すのは書き手。スライドは描く (止めない)。
 *
 * ⚠️ **目安であって、描画の実測ではない。** 数えているのは項目・行の数で、字の行数は
 * 「1 行に入る字数」で割った見積もり。数はテーマ (`slide.css`) の字の大きさと余白を
 * 実物で測って決めてある。**テーマの大きさを変えたら、ここも測り直すこと。**
 */

export interface OverfullWarning {
  /** 何ページ目か (1 始まり。表紙が 1)。 */
  readonly page: number;
  readonly reason: string;
}

interface Limits {
  readonly listItems: number;
  /** 折り返したあとの行数の上限と、1 行に入る字数の見積もり (全角で数える)。 */
  readonly textLines: number;
  readonly charactersPerLine: number;
  readonly codeLines: number;
  readonly tableRows: number;
}

/** 図と場所を分け合わないページ。 */
const ROOMY: Limits = {
  listItems: 7,
  textLines: 8,
  charactersPerLine: 30,
  codeLines: 9,
  tableRows: 7,
};

/**
 * 横長の図の下に積むページ。図は残った高さしかもらえないので、下に置く量が増えるほど
 * 図が小さくなる。図が読める大きさで残る量に抑える。
 */
const UNDER_FIGURE: Limits = {
  listItems: 3,
  textLines: 3,
  charactersPerLine: 30,
  codeLines: 4,
  tableRows: 3,
};

/** 縦長の図の横に並べるページ。高さは使えるが、幅が 6 割ほどになる。 */
const BESIDE_FIGURE: Limits = {
  listItems: 5,
  textLines: 6,
  charactersPerLine: 17,
  codeLines: 7,
  tableRows: 5,
};

const TABLE_COLUMNS = 5;
const TITLE_CHARACTERS = 32;

function limitsFor(layout: SlideLayout): Limits {
  if (layout === "figure-over") return UNDER_FIGURE;
  if (layout === "figure-beside") return BESIDE_FIGURE;
  return ROOMY;
}

export function findOverfull(deck: SlideDeck): readonly OverfullWarning[] {
  return deck.pages.flatMap((page, index) =>
    page.kind === "content" ? reasonsFor(page).map((reason) => ({ page: index + 1, reason })) : [],
  );
}

function reasonsFor(page: ContentPage): readonly string[] {
  const limits = limitsFor(page.layout);
  const nodes = page.blocks.map((block) => block.node);

  const title = mdastToString({ type: "paragraph", children: [...page.title] }).length;
  const tables = nodes.filter((node) => node.type === "table");
  return [
    over(title, TITLE_CHARACTERS, "characters in the title"),
    over(sum(nodes, countListItems), limits.listItems, "list items"),
    over(
      sum(nodes, (node) => countTextLines(node, limits.charactersPerLine)),
      limits.textLines,
      "lines of text",
    ),
    over(
      Math.max(0, ...nodes.map((node) => countCodeLines(node))),
      limits.codeLines,
      "lines of code",
    ),
    over(
      Math.max(0, ...tables.map((table) => table.children.length)),
      limits.tableRows,
      "table rows",
    ),
    over(
      Math.max(0, ...tables.map((table) => table.children[0]?.children.length ?? 0)),
      TABLE_COLUMNS,
      "table columns",
    ),
  ].flatMap((reason) => (reason === undefined ? [] : [reason]));
}

function over(count: number, limit: number, what: string): string | undefined {
  return count > limit ? `${String(count)} ${what} (at most ${String(limit)})` : undefined;
}

function sum(nodes: readonly RootContent[], count: (node: RootContent) => number): number {
  return nodes.reduce((total, node) => total + count(node), 0);
}

/** リストの項目を、入れ子も含めて数える。入れ子の 1 項目も 1 行ぶんの高さを取る。 */
function countListItems(node: RootContent): number {
  if (node.type !== "list") return 0;
  return node.children.reduce(
    (total, item) => total + 1 + sum(item.children as RootContent[], countListItems),
    0,
  );
}

/**
 * 字が折り返して取る行数の見積もり。**項目の数が少なくても、1 項目が長ければ入らない。**
 *
 * コード・表・数式は行や行列の数で別に見るので、ここでは数えない。器 (リスト・引用) は
 * 中身を 1 つずつ数える (まとめて割ると、短い項目が並んだリストを少なく見積もる)。
 */
function countTextLines(node: RootContent, charactersPerLine: number): number {
  if (node.type === "code" || node.type === "table" || node.type === "math") return 0;
  if (node.type === "list" || node.type === "listItem" || node.type === "blockquote") {
    return sum(node.children, (child) => countTextLines(child, charactersPerLine));
  }
  return Math.ceil(mdastToString(node).length / charactersPerLine);
}

function countCodeLines(node: RootContent): number {
  return node.type === "code" ? node.value.split("\n").length : 0;
}
