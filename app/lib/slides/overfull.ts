import { toString as mdastToString } from "mdast-util-to-string";
import type { ContentPage, SlideBlock, SlideDeck } from "./deck";
import type { RootContent } from "mdast";

/*
 * 1 ページに入りきらない量を見つける (ADR 0052)。
 *
 * **入りきらないものを縮めて押し込まない。** LaTeX の Overfull \hbox と同じ考え方で、
 * 同期の結果に警告として出し、直すのは書き手。スライドは描く (止めない)。
 *
 * ⚠️ **目安であって、描画の実測ではない。** 数えているのは項目・字・行の数で、実際に
 * 枠からはみ出すかはテーマの字の大きさで決まる。テーマを直したら、ここも実物と突き
 * 合わせて直すこと。
 */

export interface OverfullWarning {
  /** 何ページ目か (1 始まり。表紙が 1)。 */
  readonly page: number;
  readonly reason: string;
}

interface Limits {
  readonly listItems: number;
  readonly characters: number;
  readonly codeLines: number;
  readonly tableRows: number;
}

/** 図と並べないページの目安。 */
const ROOMY: Limits = { listItems: 6, characters: 240, codeLines: 12, tableRows: 7 };

/** 図と場所を分け合うページの目安。使える広さが半分ほどになる。 */
const BESIDE_FIGURE: Limits = { listItems: 4, characters: 140, codeLines: 7, tableRows: 4 };

const TABLE_COLUMNS = 5;
const TITLE_CHARACTERS = 32;

export function findOverfull(deck: SlideDeck): readonly OverfullWarning[] {
  return deck.pages.flatMap((page, index) =>
    page.kind === "content" ? reasonsFor(page).map((reason) => ({ page: index + 1, reason })) : [],
  );
}

function reasonsFor(page: ContentPage): readonly string[] {
  const limits = page.figure === null ? ROOMY : BESIDE_FIGURE;
  const nodes = page.blocks.map((block: SlideBlock) => block.node);

  const title = mdastToString({ type: "paragraph", children: [...page.title] }).length;
  const listItems = sum(nodes, countListItems);
  const characters = sum(nodes, countCharacters);
  const codeLines = Math.max(0, ...nodes.map((node) => countCodeLines(node)));
  const tableRows = Math.max(
    0,
    ...nodes.map((node) => (node.type === "table" ? node.children.length : 0)),
  );
  const tableColumns = Math.max(
    0,
    ...nodes.map((node) => (node.type === "table" ? (node.children[0]?.children.length ?? 0) : 0)),
  );

  return [
    over(title, TITLE_CHARACTERS, "characters in the title"),
    over(listItems, limits.listItems, "list items"),
    over(characters, limits.characters, "characters"),
    over(codeLines, limits.codeLines, "lines of code"),
    over(tableRows, limits.tableRows, "table rows"),
    over(tableColumns, TABLE_COLUMNS, "table columns"),
  ].flatMap((reason) => (reason === undefined ? [] : [reason]));
}

function over(count: number, limit: number, what: string): string | undefined {
  return count > limit ? `${String(count)} ${what} (at most ${String(limit)})` : undefined;
}

function sum(nodes: readonly RootContent[], count: (node: RootContent) => number): number {
  return nodes.reduce((total, node) => total + count(node), 0);
}

/** リストの項目を、入れ子も含めて数える。入れ子の 1 行も 1 行ぶんの高さを取る。 */
function countListItems(node: RootContent): number {
  if (node.type !== "list") return 0;
  return node.children.reduce(
    (total, item) => total + 1 + sum(item.children as RootContent[], countListItems),
    0,
  );
}

/** 字の数。コードと表は行の数で別に見るので、ここでは数えない。 */
function countCharacters(node: RootContent): number {
  if (node.type === "code" || node.type === "table" || node.type === "math") return 0;
  return mdastToString(node).length;
}

function countCodeLines(node: RootContent): number {
  return node.type === "code" ? node.value.split("\n").length : 0;
}
