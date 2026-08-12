import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { VFile } from "vfile";
import { matter } from "vfile-matter";
import type { Nodes, Root, RootContent } from "mdast";

const SUMMARY_MAX_CHARS = 160;

const markdownProcessor = unified().use(remarkParse).use(remarkGfm);

/** フロントマターから取り出した生のメタデータ (検証前)。 */
export interface NoteFrontmatter {
  readonly title: string | undefined;
  readonly imageUrl: string | undefined;
  readonly tags: readonly string[];
  readonly publishedOn: string | undefined;
  readonly lastModifiedOn: string | undefined;
}

export interface ParsedNoteContent {
  readonly frontmatter: NoteFrontmatter;
  /** フロントマターを除いた本文の MDAST。 */
  readonly mdast: Root;
  /** 見出し・脚注を除いた本文先頭 160 文字の要約。 */
  readonly summary: string;
}

/**
 * Markdown を解析してフロントマター・MDAST・要約に分解する。
 * フロントマターは vfile-matter で抽出・除去し、残りの本文を MDAST に変換する。
 */
export function parseNoteContent(markdown: string): ParsedNoteContent {
  const file = new VFile({ value: markdown });
  matter(file, { strip: true });
  const rawMatter = (file.data.matter ?? {}) as Record<string, unknown>;

  const mdast = withCollapsedSoftBreaks(markdownProcessor.parse(file));

  return {
    frontmatter: {
      title: asOptionalString(rawMatter.title),
      imageUrl: asOptionalString(rawMatter.imageUrl),
      tags: asStringArray(rawMatter.tags),
      publishedOn: asDateString(rawMatter.publishedOn),
      lastModifiedOn: asDateString(rawMatter.lastModifiedOn),
    },
    mdast,
    summary: extractSummary(mdast),
  };
}

/*
 * 改行を挟んで直に繋げてよい文字。いわゆる全角の範囲を採る。
 *
 * 句読点 (、。) や全角括弧は Unicode の Script では Common に落ちるため、
 * `\p{Script=Han}` のような書き方では拾えない。範囲で並べる。
 */
const collapsibleAcrossBreak =
  // eslint-disable-next-line security/detect-unsafe-regex -- 文字クラス 1 つの照合で、後戻りする余地がない
  /[\u{2E80}-\u{303F}\u{3040}-\u{30FF}\u{3400}-\u{4DBF}\u{4E00}-\u{9FFF}\u{AC00}-\u{D7AF}\u{F900}-\u{FAFF}\u{FF00}-\u{FF60}\u{FFE0}-\u{FFE6}\u{20000}-\u{2FFFD}]/u;

function isCollapsibleAcrossBreak(character: string): boolean {
  return character.length > 0 && collapsibleAcrossBreak.test(character);
}

/*
 * 端の 1 文字をコードポイント単位で取る。拡張漢字はサロゲートペアで表されるので、
 * コードユニットで切ると片割れだけを見てしまう (`u` 付きの `.` は 1 コードポイントに合う)。
 */
function lastCharacterOf(text: string): string {
  return /.$/u.exec(text)?.[0] ?? "";
}

function firstCharacterOf(text: string): string {
  return /^./u.exec(text)?.[0] ?? "";
}

/**
 * 文中の改行を、前後の文字に応じて畳む。
 *
 * CommonMark は soft line break を空白 1 個として扱う。単語の区切りが空白である欧文では
 * それが正しいが、日本語には単語間の空白が無いので、文節ごとに改行した原稿の改行位置に
 * 隙間が空いてしまう。前後がともに全角なら改行ごと落とし、そうでなければ空白を残す
 * (和欧混植の境目の空白は表記として要る)。
 *
 * 判定は「改行を挟む 2 文字」で行う。value の端にある改行は、前後の兄弟ノードの端の文字を
 * 渡してもらう。
 */
function collapseSoftBreaks(
  value: string,
  before: string,
  after: string,
): string {
  return value.replaceAll("\n", (_match, offset: number) => {
    const previous = lastCharacterOf(value.slice(0, offset)) || before;
    const next = firstCharacterOf(value.slice(offset + 1)) || after;
    return isCollapsibleAcrossBreak(previous) && isCollapsibleAcrossBreak(next)
      ? ""
      : " ";
  });
}

/**
 * 兄弟の並びを見ながら、各 text ノードの改行を畳む。
 *
 * 改行はリンクや強調をまたぐと別ノードに割れる (`text("…も、\n"), link(…),
 * text("\n以来…")`)。text ノード単体では改行の向こう側の文字が分からないため、
 * 隣のノードを文字列化して端の 1 文字を渡す。
 */
function collapseAcrossSiblings(
  children: readonly RootContent[],
): RootContent[] {
  return children.map((child, index) => {
    if (child.type !== "text") return child;

    // 端では隣が居ない。index で判ずる (添字アクセスの型は undefined を含まない)。
    const before =
      index === 0 ? "" : lastCharacterOf(mdastToString(children[index - 1]));
    const after =
      index === children.length - 1
        ? ""
        : firstCharacterOf(mdastToString(children[index + 1]));

    return { ...child, value: collapseSoftBreaks(child.value, before, after) };
  });
}

/**
 * 木を写しながら文中の改行を畳む。元の木は変えない。
 *
 * 触るのは text ノードだけなので、コードブロック・インラインコード・生 HTML の中の改行は
 * そのまま残る (どれも text ではない)。
 */
function withCollapsedSoftBreaks<T extends Nodes>(node: T): T {
  if (!("children" in node)) return node;

  const children = collapseAcrossSiblings(
    node.children.map((child) => withCollapsedSoftBreaks(child)),
  );
  // 子の種別は写しても変わらないので、親の型はそのまま保たれる。
  return { ...node, children };
}

/**
 * 見出し・脚注定義・水平線・生 HTML を除いた本文ブロックのテキストを連結し、
 * 先頭 160 文字を返す。
 */
export function extractSummary(root: Root): string {
  const parts: string[] = [];
  let length = 0;
  for (const node of root.children) {
    if (!isSummaryNode(node)) continue;
    const text = summaryTextOf(node).trim();
    if (text.length === 0) continue;
    parts.push(text);
    length += text.length + 1; // 連結時の区切りスペース分
    if (length >= SUMMARY_MAX_CHARS) break;
  }
  return parts
    .join(" ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, SUMMARY_MAX_CHARS);
}

/*
 * 要約に含めないノード種別。html を含めるのは、生 HTML のタグ文字列 (`<s>` や
 * `<div class='box'>`) がそのまま要約に露出するのを防ぐため。段落中に現れる
 * インライン HTML も対象なので、判定は入れ子の内側まで再帰的に効かせる。
 */
const excludedFromSummary = new Set<Nodes["type"]>([
  "heading",
  "footnoteDefinition",
  "thematicBreak",
  "code",
  "html",
]);

function isSummaryNode(node: Nodes): boolean {
  return !excludedFromSummary.has(node.type);
}

/**
 * ノード配下のテキストを、除外対象のノードを飛ばしながら連結する。
 * 葉ノードの文字列化 (画像の alt を含む) は mdast-util-to-string に委ねる。
 */
function summaryTextOf(node: RootContent): string {
  if (!("children" in node)) return mdastToString(node);
  return node.children
    .filter((child) => isSummaryNode(child))
    .map((child) => summaryTextOf(child))
    .join("");
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * フロントマターの tags を文字列配列に正規化する。配列以外は空配列に、各要素は
 * trim し空文字を除き、重複を除去する (定義順は保つ)。
 */
function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/**
 * フロントマターの日付を ISO 日付文字列にそろえる。YAML パーサが文字列で返す場合と
 * Date で返す場合の両方に備える。
 */
function asDateString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return undefined;
}
