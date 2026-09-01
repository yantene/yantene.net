import type { Nodes, Root } from "mdast";

/**
 * ベクトルにするテキストから外すノード。
 *
 * - code: コードブロックと Mermaid のソース。設定ファイルの断片が長く、記事の主題より
 *   語数で勝ってしまう。同じ理由で要約からも外している
 * - math / inlineMath: ノードが持つのは LaTeX の原文なので、`\frac` のような制御綴りが
 *   混ざる
 * - html: 生 HTML のタグ文字列
 * - yaml: フロントマター
 */
const excludedTypes: ReadonlySet<string> = new Set(["code", "math", "inlineMath", "html", "yaml"]);

/**
 * 記事をベクトルにするための文字列を組む。
 *
 * **タグは入れない。** タグを畳み込むと、タグの付け方の癖がそのままベクトルに移る。
 * タグを使わずに近さを出すための仕組みなので、入力に混ぜたら意味が無くなる。
 *
 * 返すのは分割済みの配列。モデルが 1 度に受け取れる長さを超える記事は、分けて投げて
 * 平均を取る (EmbeddingVector.mean)。切り捨てると、長い記事の後半が近さに効かなくなる。
 */
export function buildEmbeddingChunks(
  title: string,
  mdast: Root,
  maxCharacters: number,
): readonly string[] {
  const body = collectText(mdast).replaceAll(/\s+/g, " ").trim();
  const whole = body.length === 0 ? title : `${title}\n${body}`;
  return splitByLength(whole, maxCharacters);
}

/** 除外する種別を飛ばしながらテキストを集める。 */
function collectText(node: Nodes): string {
  if (excludedTypes.has(node.type)) return "";
  if ("value" in node && typeof node.value === "string") return node.value;
  if (!("children" in node)) return "";
  return node.children.map((child) => collectText(child)).join(" ");
}

/**
 * 長さで切る。
 *
 * 文の途中で切れるが、境目の 1 文が 2 つの塊に分かれても、平均を取る前提なら
 * 近さへの影響は小さい。境目を文単位に揃える手当ては、効果を測ってからにする。
 */
function splitByLength(text: string, maxCharacters: number): readonly string[] {
  if (maxCharacters <= 0) {
    throw new RangeError("maxCharacters must be a positive number.");
  }
  if (text.length <= maxCharacters) return [text];
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += maxCharacters) {
    chunks.push(text.slice(index, index + maxCharacters));
  }
  return chunks;
}
