import type { Heading, PhrasingContent, Root, RootContent } from "mdast";

export type TocEntry = {
  readonly id: string;
  readonly depth: number;
  readonly text: string;
  readonly number: string;
};

/** Heading ノードをキーとした一意 ID のマップ。 */
export type HeadingNodeIdMap = ReadonlyMap<Heading, string>;

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

export type HeadingNumberMap = ReadonlyMap<string, string>;

/**
 * Build a map from each Heading node to its unique HTML id.
 * Duplicate texts get a numeric suffix: "foo", "foo-2", "foo-3", …
 */
export function buildHeadingNodeIdMap(tree: Root): HeadingNodeIdMap {
  const seenIds = new Map<string, number>();
  const result = new Map<Heading, string>();

  for (const node of tree.children) {
    if (node.type !== "heading") continue;
    const rawBaseId = textToSlug(extractText(node.children));
    const baseId = rawBaseId || `heading-${String(result.size + 1)}`;
    const count = seenIds.get(baseId) ?? 0;
    seenIds.set(baseId, count + 1);
    const uniqueId = count === 0 ? baseId : `${baseId}-${String(count + 1)}`;
    result.set(node, uniqueId);
  }

  return result;
}

/**
 * Build a map from heading ID to its section number (e.g. "1.", "1.1.", "1.1.1.").
 * Only h2-h4 are numbered. h1 is skipped (used as article title).
 */
export function buildHeadingNumberMap(tree: Root): HeadingNumberMap {
  const nodeIdMap = buildHeadingNodeIdMap(tree);
  let h2 = 0;
  let h3 = 0;
  let h4 = 0;
  const entries: [string, string][] = [];

  for (const node of tree.children) {
    if (node.type !== "heading") continue;
    if (node.depth < 2 || node.depth > 4) continue;

    const id = nodeIdMap.get(node) ?? "";

    switch (node.depth) {
      case 2: {
        h2 += 1;
        h3 = 0;
        h4 = 0;
        entries.push([id, `${String(h2)}.`]);
        break;
      }
      case 3: {
        h3 += 1;
        h4 = 0;
        entries.push([id, `${String(h2)}.${String(h3)}.`]);
        break;
      }
      case 4: {
        h4 += 1;
        entries.push([id, `${String(h2)}.${String(h3)}.${String(h4)}.`]);
        break;
      }
    }
  }

  return new Map(entries);
}

/**
 * Extract table-of-contents entries from an MDAST tree.
 * Only includes h2-h4 (h1 is the article title).
 */
export function extractTocEntries(tree: Root): readonly TocEntry[] {
  const numberMap = buildHeadingNumberMap(tree);
  const nodeIdMap = buildHeadingNodeIdMap(tree);

  return tree.children
    .filter((node: RootContent): node is Heading => node.type === "heading")
    .flatMap((node): readonly TocEntry[] => {
      if (node.depth < 2 || node.depth > 4) return [];
      const text = extractText(node.children);
      const id = nodeIdMap.get(node) ?? textToSlug(text);
      const number = numberMap.get(id) ?? "";
      return [{ id, depth: node.depth, text, number }];
    });
}

/**
 * Get the heading ID for a given heading node.
 * Falls back to the provided fallback string if the slug is empty.
 */
export function getHeadingId(node: Heading, fallback: string = ""): string {
  return textToSlug(extractText(node.children)) || fallback;
}
