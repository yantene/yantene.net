import type { Nodes, Root } from "mdast";

/**
 * 1 分で読める字数。日本語の黙読はおおむね 400 〜 600 字/分と言われるので、その真ん中を取る。
 *
 * 本文はいまのところ全部日本語 (content-language.ts)。英語の記事が入ったら、語数で
 * 数える別の物差しを足すことになる。
 */
const CHARACTERS_PER_MINUTE = 500;

/*
 * 数えない節。読み飛ばすか、字の数と読む時間が釣り合わないもの。
 *
 * - code: 読むというより眺めるもの。行数のわりに字数が多く、時間を大きく見積もりすぎる
 * - html: タグの字が混ざる
 * - math / inlineMath: 値は LaTeX の原文で、`\frac{a}{b}` の字数は読む時間と関係がない
 */
const SKIPPED: ReadonlySet<string> = new Set(["code", "html", "math", "inlineMath"]);

function countCharacters(node: Nodes): number {
  if (SKIPPED.has(node.type)) return 0;
  if (node.type === "text" || node.type === "inlineCode") {
    // 空白は字として数えない (英単語の間や改行で数が膨らまないように)。
    return node.value.replaceAll(/\s/g, "").length;
  }
  if (!("children" in node)) return 0;
  return node.children.reduce((sum, child) => sum + countCharacters(child), 0);
}

/**
 * 本文を読み終えるまでのおおよその分数。記事の頭に「約 N 分で読めます」と出す。
 *
 * 1 分に満たない短い記事も 1 分と言う。「0 分」は読む前から読み終えていることになる。
 */
export function estimateReadingMinutes(root: Root): number {
  return Math.max(1, Math.round(countCharacters(root) / CHARACTERS_PER_MINUTE));
}
