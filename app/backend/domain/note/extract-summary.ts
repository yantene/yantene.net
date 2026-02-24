import { SKIP, visit } from "unist-util-visit";
import type { Root } from "mdast";

const DEFAULT_MAX_LENGTH = 160;

export function extractSummary(
  tree: Root,
  maxLength: number = DEFAULT_MAX_LENGTH,
): string {
  const textParts: string[] = [];

  visit(tree, (node) => {
    if (node.type === "heading") return SKIP;
    if (node.type === "footnoteDefinition") return SKIP;
    if (node.type === "text" || node.type === "inlineCode") {
      textParts.push(node.value);
    }
  });

  const fullText = textParts.join(" ").replaceAll(/\s+/g, " ").trim();

  if (fullText.length <= maxLength) return fullText;

  return `${fullText.slice(0, maxLength)}...`;
}
