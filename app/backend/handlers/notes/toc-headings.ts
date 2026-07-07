import GithubSlugger from "github-slugger";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Root } from "mdast";

/** 目次の 1 見出し。id はレンダリング側 (rehype-slug) の見出し id と一致する。 */
export interface TocHeading {
  readonly id: string;
  readonly text: string;
  readonly level: 2 | 3;
}

/**
 * MDAST から目次用の見出し (h2/h3) を document 順に抽出する。
 *
 * id は rehype-slug と同じ github-slugger で採番するため、MdastRenderer が付ける
 * 見出し id と一致する。重複採番のカウンタを rehype-slug と揃えるため、目次に
 * 出さない depth の見出しでも slugger は進める。
 */
export function extractHeadings(root: Root): readonly TocHeading[] {
  const slugger = new GithubSlugger();
  const headings: TocHeading[] = [];
  for (const node of root.children) {
    if (node.type !== "heading") continue;
    const text = mdastToString(node).trim();
    const id = slugger.slug(text);
    if ((node.depth === 2 || node.depth === 3) && text.length > 0) {
      headings.push({ id, text, level: node.depth });
    }
  }
  return headings;
}
