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

  const mdast = markdownProcessor.parse(file);

  return {
    frontmatter: {
      title: asOptionalString(rawMatter.title),
      imageUrl: asOptionalString(rawMatter.imageUrl),
      publishedOn: asDateString(rawMatter.publishedOn),
      lastModifiedOn: asDateString(rawMatter.lastModifiedOn),
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
  for (const node of root.children) {
    if (!isSummaryNode(node)) continue;
    const text = mdastToString(node).trim();
    if (text.length > 0) parts.push(text);
    if (parts.join(" ").length >= SUMMARY_MAX_CHARS) break;
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

/**
 * フロントマターの日付を ISO 日付文字列にそろえる。YAML パーサが文字列で返す場合と
 * Date で返す場合の両方に備える。
 */
function asDateString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return undefined;
}
