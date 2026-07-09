import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { VFile } from "vfile";
import { matter } from "vfile-matter";
import type { Root, RootContent } from "mdast";

const SUMMARY_MAX_CHARS = 160;

const markdownProcessor = unified().use(remarkParse).use(remarkGfm);

/** フロントマターから取り出した生のメタデータ (検証前)。 */
export interface NoteFrontmatter {
  readonly title: string | undefined;
  readonly imageUrl: string | undefined;
  readonly tags: readonly string[];
  readonly publishedOn: string | undefined;
  readonly lastModifiedOn: string | undefined;
  /** 連載名 (表示名)。単発記事では undefined。 */
  readonly series: string | undefined;
  /** 連載内の並び順。series があるときのみ意味を持つ。 */
  readonly seriesOrder: number | undefined;
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

  const mdast = markdownProcessor.parse(file);

  return {
    frontmatter: {
      title: asOptionalString(rawMatter.title),
      imageUrl: asOptionalString(rawMatter.imageUrl),
      tags: asStringArray(rawMatter.tags),
      publishedOn: asDateString(rawMatter.publishedOn),
      lastModifiedOn: asDateString(rawMatter.lastModifiedOn),
      series: asOptionalString(rawMatter.series),
      seriesOrder: asOptionalNumber(rawMatter.seriesOrder),
    },
    mdast,
    summary: extractSummary(mdast),
  };
}

/**
 * 見出し・脚注定義・水平線を除いた本文ブロックのテキストを連結し、先頭 160 文字を返す。
 */
export function extractSummary(root: Root): string {
  const parts: string[] = [];
  let length = 0;
  for (const node of root.children) {
    if (!isSummaryNode(node)) continue;
    const text = mdastToString(node).trim();
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

const excludedFromSummary = new Set<RootContent["type"]>([
  "heading",
  "footnoteDefinition",
  "thematicBreak",
  "code",
]);

function isSummaryNode(node: RootContent): boolean {
  return !excludedFromSummary.has(node.type);
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** フロントマターの数値。number か数字文字列を受け、それ以外は undefined。 */
function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
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
