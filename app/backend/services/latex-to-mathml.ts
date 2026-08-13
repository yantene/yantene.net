import { fromHtml } from "hast-util-from-html";
import temml from "temml";
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
 *
 * 組むのは Temml。**KaTeX ではない。** KaTeX の MathML 出力はスクリーンリーダー向けの
 * 意味の層で (本体の CSS が `.katex-mathml` を画面から隠している)、視覚描画に必要な
 * 情報が入っていない。Temml は MathML だけで組む前提のライブラリなので、関数名の後ろの
 * アキのような TeX の作法がそのまま出力に乗る (ADR 0018)。
 *
 * **出力の inline style はそのまま通す。** Temml は表組みの桁や数式番号の位置を CSS で
 * 渡してくる。以前はそれを MathML の中へ移し替えていたが、そのための後処理がこのファイルの
 * 大半を占め、上流が値を変えるたびに追随が要る状態になっていた。`style-src` に
 * `'unsafe-inline'` を置いたのはこれをやめるため (ADR 0019)。数式以外に inline style が
 * 入らないよう、sanitize の allowlist は MathML の要素にだけ `style` を許している
 * (components/mdast/mathml.ts)。
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
  /** `<math>` の子 (Temml は semantics で組版と原文を包む)。 */
  readonly children: ElementContent[];
}

export interface MathMlOptions {
  /** 別行立て (`$$...$$`) なら true。`display="block"` が付く。 */
  readonly display: boolean;
}

const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";

/**
 * LaTeX を MathML の hast に変換する。読めない式は {@link MathSyntaxError} を送出する。
 */
export function latexToMathMl(latex: string, options: MathMlOptions): MathMl {
  const markup = renderMathMl(latex, options);
  const math = findMath(fromHtml(markup, { fragment: true }));
  if (math === undefined) {
    // 出力の形が変わったら、数式が黙って消える前にここで落とす (fail-loud)。
    throw new Error(`Temml returned no <math> element for: ${latex}`);
  }
  return {
    properties: {
      /*
       * Temml は `xmlns` を出さない。HTML の中では省いても MathML として読まれるが、
       * Atom フィードは XML なので名前空間が要る。ここで必ず付けておく。
       */
      xmlns: MATHML_NAMESPACE,
      ...math.properties,
    },
    children: math.children.map((child) => withoutPositions(child)),
  };
}

/**
 * Temml に MathML を吐かせる。
 *
 * KaTeX の既定の HTML 出力は span に inline style で位置を指定するため、MathML 以外の
 * 出力は使えなかった (ADR 0013)。Temml は MathML だけで組むので、その制約が無い。
 */
function renderMathMl(latex: string, options: MathMlOptions): string {
  try {
    return temml.renderToString(latex, {
      displayMode: options.display,
      // 原文を <annotation> に残す。Temml の既定は off なので明示する。
      annotate: true,
      // 読めない式に赤字を出して済ませず送出する。書き手に気づかせる (fail-loud)。
      throwOnError: true,
      // 既定値だが明示する。true にすると \href / \includegraphics が開き、
      // 本文から URL を差し込めるようになって、描画側 allowlist の前提が崩れる。
      trust: false,
    });
  } catch (error) {
    /*
     * Temml の型定義は `ParseError` を Error の派生として宣言していない
     * (`declare class ParseError {}` だけ) ので、message を読むには Error であることも
     * 確かめる必要がある。実体は Error なので、この条件は実行時には常に満たされる。
     */
    if (error instanceof temml.ParseError && error instanceof Error) {
      throw new MathSyntaxError(error.message);
    }
    throw error;
  }
}

/** 出力の中から `<math>` を探す。 */
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
 * Temml の出力文字列を読み直した座標なので、原文の行番号とも対応しない。
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
