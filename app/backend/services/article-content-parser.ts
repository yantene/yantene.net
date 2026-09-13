import { toString as mdastToString } from "mdast-util-to-string";
import { ALERT_TAG_NAME, parseMarkdownBody } from "./markdown-body";
import type { Nodes, Root, RootContent } from "mdast";
import type { ArticleStatus } from "~/backend/domain/article";
import { DEFAULT_ARTICLE_STATUS, isArticleStatus } from "~/backend/domain/article";

const SUMMARY_MAX_CHARS = 160;

/**
 * `status` として読めない値が書かれていた。旧書式の `visibility` が残っている場合も
 * これで報告する。
 *
 * 呼び出し側 (refresh) が記事単位のコンテンツ不正として拾えるよう、infra 障害と
 * 区別できる型にしておく。
 *
 * **読めない値を「隠す」に倒さない。** 隠す方が公開するより傷が浅いのは確かだが、
 * それは「隠すと決めた記事」の話であって、`status: pubished` と打ち間違えた記事は
 * 隠すと決めた覚えがない。同期しないまま、異常を異常として報告する (ADR 0040)。
 */
export class StatusValueError extends Error {
  readonly name = "StatusValueError";
}

/** フロントマターから取り出した生のメタデータ (検証前)。 */
export interface ArticleFrontmatter {
  readonly title: string | undefined;
  readonly imageUrl: string | undefined;
  readonly publishedOn: string | undefined;
  readonly lastModifiedOn: string | undefined;
  readonly status: ArticleStatus;
}

export interface ParsedArticleContent {
  readonly frontmatter: ArticleFrontmatter;
  /** フロントマターを除いた本文の MDAST (数式には MathML を埋めてある)。 */
  readonly mdast: Root;
  /** 見出し・脚注・数式を除いた本文先頭 160 文字の要約。 */
  readonly summary: string;
}

/**
 * Markdown を解析してフロントマター・MDAST・要約に分解する。
 * 本文を MDAST に組むところは markdown-body.ts が引き受け、ここは記事として
 * 何が書かれていてよいかだけを見る。
 *
 * 読めない LaTeX があると MathSyntaxError (latex-to-mathml.ts) を送出する。
 * 呼び出し側 (refresh) が記事単位で拾う。
 */
export function parseArticleContent(markdown: string): ParsedArticleContent {
  const { frontmatter: rawMatter, mdast } = parseMarkdownBody(markdown);

  return {
    frontmatter: {
      title: asOptionalString(rawMatter.title),
      imageUrl: asOptionalString(rawMatter.imageUrl),
      publishedOn: asDateString(rawMatter.publishedOn),
      lastModifiedOn: asDateString(rawMatter.lastModifiedOn),
      status: asStatus(rawMatter),
    },
    mdast,
    summary: extractSummary(mdast),
  };
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
  return parts.join(" ").replaceAll(/\s+/g, " ").trim().slice(0, SUMMARY_MAX_CHARS);
}

/*
 * 要約に含めないノード種別。html を含めるのは、生 HTML のタグ文字列 (`<s>` や
 * `<div class='box'>`) がそのまま要約に露出するのを防ぐため。段落中に現れる
 * インライン HTML も対象なので、判定は入れ子の内側まで再帰的に効かせる。
 *
 * 数式 (math / inlineMath) も同じ理由で除く。value に持つのは LaTeX 原文なので、
 * 残すと `\frac{-b \pm \sqrt{b^2-4ac}}{2a}` が一覧や OGP にそのまま出てしまう。
 */
const excludedFromSummary = new Set<Nodes["type"]>([
  "heading",
  "footnoteDefinition",
  "thematicBreak",
  "code",
  "html",
  "math",
  "inlineMath",
]);

/**
 * Alert (`> [!NOTE]`) は本文ではなく但し書きなので要約から外す。
 *
 * 記事の頭に「リンク先が消えた」「画像を紛失した」と断りを置くことがあり、
 * これを数えると一覧と OGP がその文言で埋まる。読者が最初に見るのは記事の書き出しで
 * あってほしい。ラベルの無い引用は本文の一部なので、これまでどおり数える。
 */
function isAlertNode(node: Nodes): boolean {
  return node.type === "blockquote" && node.data?.hName === ALERT_TAG_NAME;
}

function isSummaryNode(node: Nodes): boolean {
  return !excludedFromSummary.has(node.type) && !isAlertNode(node);
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
 * フロントマターの status を読む (ADR 0040)。
 *
 * 書いていなければ `published`。読めない値は {@link StatusValueError} を送出する。
 *
 * **旧書式の `visibility` が残っていたらエラーにする。** 無視して既定の `published` に
 * 倒すと、`visibility: private` と書いたままの下書きが黙って公開される。値が何であっても
 * (`public` でも) 同じく弾く — 綴りを見て倒し方を変えると、倒し方の一覧が次の漏れになる。
 *
 * ⚠️ **気づき方が 2 通りある。** まだ同期していない記事は出てこないので分かるが、
 * **既に D1 に載っている記事は前の中身のまま配信され続ける** (migration の既定で
 * `status = 'published'` が入っているため)。画面は正常に見えるのに更新だけが
 * 反映されなくなるので、気づく手立ては refresh の応答の `skipped` しか無い。
 * コンテンツリポジトリ側の書き換えは、取りこぼさず一度に済ませること。
 */
function asStatus(rawMatter: Record<string, unknown>): ArticleStatus {
  if ("visibility" in rawMatter) {
    throw new StatusValueError(
      "frontmatter still has the former `visibility` key; rename it to `status` (ADR 0040)",
    );
  }

  const value = rawMatter.status;
  if (value === undefined || value === null) return DEFAULT_ARTICLE_STATUS;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (isArticleStatus(normalized)) return normalized;
  }
  throw new StatusValueError(`frontmatter has unreadable status: ${JSON.stringify(value)}`);
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
