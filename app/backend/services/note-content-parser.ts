import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { VFile } from "vfile";
import { matter } from "vfile-matter";
import { latexToMathMl } from "./latex-to-mathml";
import type { Nodes, Root, RootContent } from "mdast";

const SUMMARY_MAX_CHARS = 160;

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath);

/** フロントマターから取り出した生のメタデータ (検証前)。 */
/**
 * 記事の公開範囲。フロントマターの `visibility` で指定する。
 *
 * 既定は `public`。`private` を書いた記事は同期の対象から外れ、D1 にも R2 にも
 * 載らない (notes-refresh.service.ts)。読み取れない値は `private` に倒す。
 * 誤って公開する方が、誤って隠すより取り返しがつかない。
 */
export type NoteVisibility = "public" | "private";

export interface NoteFrontmatter {
  readonly title: string | undefined;
  readonly imageUrl: string | undefined;
  readonly tags: readonly string[];
  readonly publishedOn: string | undefined;
  readonly lastModifiedOn: string | undefined;
  readonly visibility: NoteVisibility;
}

export interface ParsedNoteContent {
  readonly frontmatter: NoteFrontmatter;
  /** フロントマターを除いた本文の MDAST (数式には MathML を埋めてある)。 */
  readonly mdast: Root;
  /** 見出し・脚注・数式を除いた本文先頭 160 文字の要約。 */
  readonly summary: string;
}

/**
 * Markdown を解析してフロントマター・MDAST・要約に分解する。
 * フロントマターは vfile-matter で抽出・除去し、残りの本文を MDAST に変換する。
 *
 * 読めない LaTeX があると MathSyntaxError (latex-to-mathml.ts) を送出する。
 * 呼び出し側 (refresh) がノート単位で拾う。
 */
export function parseNoteContent(markdown: string): ParsedNoteContent {
  const file = new VFile({ value: markdown });
  matter(file, { strip: true });
  const rawMatter = (file.data.matter ?? {}) as Record<string, unknown>;

  // Alert の判定は改行を畳む前に済ませる。ラベル行の区切りは改行なので、
  // 畳む処理が先に走ると `[!NOTE] 本文` と繋がって見分けが付かなくなる。
  const parsed = markdownProcessor.parse(file);
  const collapsed = withCollapsedSoftBreaks(withGfmAlerts(parsed));
  const mdast = withMathMl(collapsed);

  return {
    frontmatter: {
      title: asOptionalString(rawMatter.title),
      imageUrl: asOptionalString(rawMatter.imageUrl),
      tags: asStringArray(rawMatter.tags),
      publishedOn: asDateString(rawMatter.publishedOn),
      lastModifiedOn: asDateString(rawMatter.lastModifiedOn),
      visibility: asVisibility(rawMatter.visibility),
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
 * 木を写しながら、数式ノードに組み上げた MathML を埋める。元の木は変えない。
 *
 * remark-math が置く既定の data は `<code class="language-math">` / `<pre>` で、
 * そのままだと LaTeX 原文が本文に出る。ここで hName / hProperties / hChildren を
 * 差し替えると、mdast-util-to-hast がそれを `<math>` 要素として起こす。描画側は
 * 埋まった MathML を出すだけで済み、読者に数式ライブラリを送らずにすむ (ADR 0013)。
 *
 * 変換は refresh のときにしか走らない。読めない LaTeX は MathSyntaxError として
 * 送出し、呼び出し側がノート単位で拾う。
 */
function withMathMl<T extends Nodes>(node: T): T {
  if (node.type === "inlineMath" || node.type === "math") {
    const { properties, children } = latexToMathMl(node.value, {
      display: node.type === "math",
    });
    return {
      ...node,
      data: {
        ...node.data,
        hName: "math",
        hProperties: properties,
        hChildren: children,
      },
    };
  }

  if (!("children" in node)) return node;
  return { ...node, children: node.children.map((child) => withMathMl(child)) };
}

/** GFM の Alert 種別。GitHub が定める 5 つに揃える。 */
export const alertKinds = [
  "note",
  "tip",
  "important",
  "warning",
  "caution",
] as const;

export type AlertKind = (typeof alertKinds)[number];

/** 引用の冒頭に置くラベル行。`> [!NOTE]` の形で、行末に他の文字を許さない。 */
const alertLabelPattern =
  /^\[!(note|tip|important|warning|caution)\][^\S\n]*(?:\n|$)/i;

function toAlertKind(label: string): AlertKind | undefined {
  const lowered = label.toLowerCase();
  return alertKinds.find((kind) => kind === lowered);
}

/**
 * ラベル行を取り除いた引用の中身を返す。Alert でなければ undefined。
 *
 * GFM の定義に合わせ、引用の最初の段落の先頭がラベルのときだけ Alert とみなす。
 * 段落の途中や 2 つ目のブロックに現れた `[!NOTE]` はただの本文として扱う。
 */
function readAlertLabel(
  children: readonly RootContent[],
): { kind: AlertKind; children: RootContent[] } | undefined {
  const first = children.at(0);
  if (first === undefined || first.type !== "paragraph") return undefined;
  const rest = children.slice(1);

  const lead = first.children.at(0);
  if (lead === undefined || lead.type !== "text") return undefined;
  const tail = first.children.slice(1);

  const matched = alertLabelPattern.exec(lead.value);
  const label = matched?.[1];
  if (matched === null || label === undefined) return undefined;

  const kind = toAlertKind(label);
  if (kind === undefined) return undefined;

  const remainder = lead.value.slice(matched[0].length);

  // ラベル行しか無ければ段落ごと落とす。`> [!NOTE]` だけの引用は中身が空になる。
  const leadingParagraph: RootContent[] =
    remainder.length === 0 && tail.length === 0
      ? []
      : [
          {
            ...first,
            children:
              remainder.length === 0
                ? tail
                : [{ ...lead, value: remainder }, ...tail],
          },
        ];

  return { kind, children: [...leadingParagraph, ...rest] };
}

/**
 * 木を写しながら、GFM の Alert 記法 (`> [!NOTE]`) を引用から起こす。元の木は変えない。
 *
 * ラベル行は本文から取り除き、種別だけを data に載せる。描画側は hName で拾った
 * 要素にアイコンと見出しを添える。ラベルを本文に残さないのは、要約 (冒頭 160 文字) と
 * 検索インデックスに `[!NOTE]` という文字列が混ざらないようにするため。
 *
 * 変換は refresh のときにしか走らない。MDAST を正本として R2 に置く構成 (ADR 0005) に
 * 合わせ、描画側では引用の中身を判定しない。
 */
function withGfmAlerts<T extends Nodes>(node: T): T {
  if (!("children" in node)) return node;

  const children = node.children.map((child) => withGfmAlerts(child));
  if (node.type !== "blockquote") return { ...node, children };

  const alert = readAlertLabel(children);
  if (alert === undefined) return { ...node, children };

  return {
    ...node,
    children: alert.children,
    data: {
      ...node.data,
      hName: ALERT_TAG_NAME,
      hProperties: { kind: alert.kind },
    },
  };
}

/** Alert を運ぶ要素名。本文からは書けない、こちらが組み立てた印。 */
export const ALERT_TAG_NAME = "markdown-alert";

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
 * フロントマターの visibility を読む。
 *
 * 書いていなければ公開。`public` / `private` 以外が書かれていたら公開しない。
 * 綴りを間違えた記事が黙って世に出るより、出ない方が傷が浅い。
 */
function asVisibility(value: unknown): NoteVisibility {
  if (value === undefined || value === null) return "public";
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "public") return "public";
    if (normalized === "private") return "private";
  }
  return "private";
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
