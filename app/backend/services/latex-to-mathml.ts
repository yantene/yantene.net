import { fromHtml } from "hast-util-from-html";
import katex from "katex";
import type {
  Element,
  ElementContent,
  Properties,
  Root as HastRoot,
  RootContent,
} from "hast";

/**
 * LaTeX を MathML に組む。
 *
 * 変換は refresh 時に一度だけ行い、結果を MDAST に埋めて R2 に置く。読者のブラウザには
 * 組み上がった MathML だけが届き、数式ライブラリは 1 バイトも送らない (ADR 0013)。
 */

/**
 * LaTeX として読めなかった数式。
 *
 * 呼び出し側 (refresh) がノート単位のコンテンツ不正として拾えるよう、infra 障害と
 * 区別できる型にしておく。
 */
export class MathSyntaxError extends Error {
  readonly name = "MathSyntaxError";
}

/** `<math>` 要素を、MDAST の data (hProperties / hChildren) に渡せる形にしたもの。 */
export interface MathMl {
  /** `<math>` 自身の属性 (xmlns と、別行立てなら display)。 */
  readonly properties: Properties;
  /** `<math>` の子 (KaTeX は semantics で組版と原文を包む)。 */
  readonly children: ElementContent[];
}

export interface MathMlOptions {
  /** 別行立て (`$$...$$`) なら true。`display="block"` が付く。 */
  readonly display: boolean;
}

/**
 * LaTeX を MathML の hast に変換する。読めない式は {@link MathSyntaxError} を送出する。
 */
export function latexToMathMl(latex: string, options: MathMlOptions): MathMl {
  const markup = renderMathMl(latex, options);
  const math = findMath(fromHtml(markup, { fragment: true }));
  if (math === undefined) {
    // KaTeX の出力の形が変わったら、数式が黙って消える前にここで落とす (fail-loud)。
    throw new Error(`KaTeX returned no <math> element for: ${latex}`);
  }
  return {
    properties: math.properties,
    children: math.children.map((child) => withoutPositions(child)),
  };
}

/**
 * KaTeX に MathML だけを吐かせる。
 *
 * 既定の HTML 出力は span に inline style で位置を指定するため、`style-src 'self'` の
 * 下ではブラウザが style 属性を丸ごと無視し、例外も警告も出ないまま組版が崩れる
 * (ADR 0007)。MathML 出力に限ること。
 */
function renderMathMl(latex: string, options: MathMlOptions): string {
  try {
    return katex.renderToString(latex, {
      output: "mathml",
      displayMode: options.display,
      // 読めない式に赤字を出して済ませず送出する。書き手に気づかせる (fail-loud)。
      throwOnError: true,
      // 既定値だが明示する。true にすると \href / \includegraphics / \htmlClass が開き、
      // 本文から URL・class を差し込めるようになって、描画側 allowlist の前提が崩れる。
      trust: false,
    });
  } catch (error) {
    if (error instanceof katex.ParseError) {
      throw new MathSyntaxError(error.message);
    }
    throw error;
  }
}

/** 出力の中から `<math>` を探す (KaTeX は `<span class="katex">` で包んで返す)。 */
function findMath(node: HastRoot | RootContent): Element | undefined {
  if (node.type === "element" && node.tagName === "math") return node;
  if (!("children" in node)) return undefined;
  for (const child of node.children) {
    const found = findMath(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * 位置情報を落とした複製を返す。
 *
 * MDAST は JSON にして R2 に置くので、描画に使わない座標まで運ぶ意味がない。しかも
 * KaTeX の出力文字列を読み直した座標なので、原文の行番号とも対応しない。
 */
function withoutPositions(node: ElementContent): ElementContent {
  if (node.type === "element") {
    return {
      type: "element",
      tagName: node.tagName,
      properties: node.properties,
      children: node.children.map((child) => withoutPositions(child)),
    };
  }
  if (node.type === "text") return { type: "text", value: node.value };
  if (node.type === "comment") return { type: "comment", value: node.value };
  // HTML パーサが返すのは element / text / comment だけ。ElementContent に混ざる
  // 他の種別 (raw / MDX) は他のユーティリティによる型の拡張で、ここには現れない。
  return node;
}
