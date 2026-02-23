import type { Heading, PhrasingContent, Root, RootContent } from "mdast";

export type TocEntry = {
  readonly id: string;
  readonly depth: number;
  readonly text: string;
};

/**
 * Recursively extract plain text from phrasing content nodes.
 */
const extractText = (nodes: readonly PhrasingContent[]): string =>
  nodes
    .map((node): string => {
      if (node.type === "text" || node.type === "inlineCode") {
        return node.value;
      }
      if ("children" in node) {
        return extractText(node.children as readonly PhrasingContent[]);
      }
      return "";
    })
    .join("");

/**
 * Convert heading text to a URL-friendly slug for use as an HTML id.
 * Keeps CJK characters, alphanumerics, and hyphens.
 */
const textToSlug = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "-")
    .replaceAll(/[^\p{L}\p{N}-]/gu, "")
    .replaceAll(/-{2,}/g, "-")
    .replaceAll(/(?:^-|-$)/g, "");

/**
 * Extract table-of-contents entries from an MDAST tree.
 * Only includes h2-h4 (h1 is the article title).
 */
export function extractTocEntries(tree: Root): readonly TocEntry[] {
  return tree.children
    .filter((node: RootContent): node is Heading => node.type === "heading")
    .flatMap((node): readonly TocEntry[] => {
      if (node.depth < 2 || node.depth > 4) return [];
      const text = extractText(node.children);
      return [{ id: textToSlug(text), depth: node.depth, text }];
    });
}

/**
 * Get the heading ID for a given heading node.
 */
export function getHeadingId(node: Heading): string {
  return textToSlug(extractText(node.children));
}
