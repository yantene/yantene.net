import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { VFile } from "vfile";
import { matter } from "vfile-matter";
import { latexToMathMl } from "./latex-to-mathml";
import { mapTree, withChildren } from "./mdast-tree";
import type { Nodes, Root, RootContent } from "mdast";

const markdownProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

/**
 * フロントマターそのものが読めなかった (YAML の構文エラー)。
 *
 * 引用符の閉じ忘れや、ブロックスカラーのインデント崩れがこれになる。**中身が読めない
 * のではなく、区切りの中が YAML として成り立っていない**ので、欄ごとの検証より手前で
 * 落ちる。呼び出し側がファイル単位のコンテンツ不正として拾えるよう、infra 障害と
 * 区別できる型にしておく。
 */
export class FrontmatterSyntaxError extends Error {
  readonly name = "FrontmatterSyntaxError";
}

/** フロントマターと本文に分けた Markdown。 */
export interface MarkdownDocument {
  /** フロントマターの生の中身 (検証前)。書いていなければ空のオブジェクト。 */
  readonly frontmatter: Record<string, unknown>;
  /** フロントマターを除いた本文の MDAST (数式には MathML を埋めてある)。 */
  readonly mdast: Root;
}

/**
 * Markdown をフロントマターと MDAST に分ける。
 *
 * **記事もプロフィールもこの 1 本を通る。** 本文の書き方 (Alert・文中の改行の畳み方・
 * 数式の組み方) は書いた場所で変わらないので、経路を分けると片方だけ古びる。
 * 種別ごとの違い (フロントマターに何を要求するか、要約を作るかどうか) は呼ぶ側が持つ。
 *
 * 読めない LaTeX があると MathSyntaxError (latex-to-mathml.ts) を送出する。
 * 呼び出し側がファイル単位で拾う。
 */
export function parseMarkdownDocument(markdown: string): MarkdownDocument {
  const file = new VFile({ value: markdown });
  try {
    matter(file, { strip: true });
  } catch (error) {
    // YAML の構文エラー。呼び出し側がファイル単位で拾えるよう名前を付け替える。
    throw new FrontmatterSyntaxError(error instanceof Error ? error.message : String(error));
  }

  // Alert の判定は改行を畳む前に済ませる。ラベル行の区切りは改行なので、
  // 畳む処理が先に走ると `[!NOTE] 本文` と繋がって見分けが付かなくなる。
  const parsed = markdownProcessor.parse(file);
  const collapsed = withCollapsedSoftBreaks(withGfmAlerts(parsed));

  return {
    frontmatter: (file.data.matter ?? {}) as Record<string, unknown>,
    mdast: withMathMl(collapsed),
  };
}

/** フロントマターの値を、中身のある文字列としてだけ読む。 */
export function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * フロントマターの日付を ISO 日付文字列にそろえる。YAML パーサが文字列で返す場合と
 * Date で返す場合の両方に備える。
 */
export function asDateString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return undefined;
}

/*
 * 改行を挟んで直に繋げてよい文字。いわゆる全角の範囲を採る。
 *
 * 句読点 (、。) や全角括弧は Unicode の Script では Common に落ちるため、
 * `\p{Script=Han}` のような書き方では拾えない。範囲で並べる。
 */
const collapsibleAcrossBreak =
  // 文字クラス 1 つの照合で、後戻りする余地がない
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
function collapseSoftBreaks(value: string, before: string, after: string): string {
  return value.replaceAll("\n", (_match, offset: number) => {
    const previous = lastCharacterOf(value.slice(0, offset)) || before;
    const next = firstCharacterOf(value.slice(offset + 1)) || after;
    return isCollapsibleAcrossBreak(previous) && isCollapsibleAcrossBreak(next) ? "" : " ";
  });
}

/**
 * 兄弟の並びを見ながら、各 text ノードの改行を畳む。
 *
 * 改行はリンクや強調をまたぐと別ノードに割れる (`text("…も、\n"), link(…),
 * text("\n以来…")`)。text ノード単体では改行の向こう側の文字が分からないため、
 * 隣のノードを文字列化して端の 1 文字を渡す。
 */
function collapseAcrossSiblings(children: readonly RootContent[]): RootContent[] {
  return children.map((child, index) => {
    if (child.type !== "text") return child;

    // 端では隣が居ない。index で判ずる (添字アクセスの型は undefined を含まない)。
    const before = index === 0 ? "" : lastCharacterOf(mdastToString(children[index - 1]));
    const after =
      index === children.length - 1 ? "" : firstCharacterOf(mdastToString(children[index + 1]));

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
  return mapTree(node, (child) =>
    "children" in child ? withChildren(child, collapseAcrossSiblings(child.children)) : child,
  );
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
 * 送出し、呼び出し側が記事単位で拾う。
 */
function withMathMl<T extends Nodes>(node: T): T {
  return mapTree(node, (child) => {
    if (child.type !== "inlineMath" && child.type !== "math") return child;

    const { properties, children } = latexToMathMl(child.value, {
      display: child.type === "math",
    });
    return {
      ...child,
      data: {
        ...child.data,
        hName: "math",
        hProperties: properties,
        hChildren: children,
      },
    };
  });
}

/** GFM の Alert 種別。GitHub が定める 5 つに揃える。 */
export const alertKinds = ["note", "tip", "important", "warning", "caution"] as const;

export type AlertKind = (typeof alertKinds)[number];

/** 引用の冒頭に置くラベル行。`> [!NOTE]` の形で、行末に他の文字を許さない。 */
const alertLabelPattern = /^\[!(note|tip|important|warning|caution)\][^\S\n]*(?:\n|$)/i;

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
            children: remainder.length === 0 ? tail : [{ ...lead, value: remainder }, ...tail],
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
 * 変換は refresh のときにしか走らない。組み上げた MDAST をそのまま R2 に置いて配信する
 * 構成 (ADR 0005) に合わせ、描画側では引用の中身を判定しない。
 */
function withGfmAlerts<T extends Nodes>(node: T): T {
  return mapTree(node, (child) => {
    if (child.type !== "blockquote") return child;

    // 印を読むのは写し終えた子から。この向きは mapTree が保証している。
    const alert = readAlertLabel(child.children);
    if (alert === undefined) return child;

    // 中身の差し替えは withChildren に通す。引用の子の型 (BlockContent) と
    // readAlertLabel が返す RootContent の食い違いを、あちらの 1 か所で吸収する。
    const body = withChildren(child, alert.children);
    return {
      ...body,
      data: {
        ...body.data,
        hName: ALERT_TAG_NAME,
        hProperties: { kind: alert.kind },
      },
    };
  });
}

/**
 * Alert を運ぶ要素名。こちらが引用から組み立てた印。
 *
 * 印ではあるが、本文の生 HTML からも書けはする (mdast-renderer.tsx の sanitizeSchema を参照)。
 */
export const ALERT_TAG_NAME = "markdown-alert";
