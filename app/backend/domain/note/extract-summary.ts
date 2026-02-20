import { visit } from "unist-util-visit";
import type { Root, Text } from "mdast";

const DEFAULT_MAX_LENGTH = 160;

export function extractSummary(
  tree: Root,
  maxLength: number = DEFAULT_MAX_LENGTH,
): string {
  const textParts: string[] = [];

  visit(tree, "text", (node: Text) => {
    textParts.push(node.value);
  });

  const fullText = textParts.join(" ").replaceAll(/\s+/g, " ").trim();

  if (fullText.length <= maxLength) return fullText;

  return `${fullText.slice(0, maxLength)}...`;
}
