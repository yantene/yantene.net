import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { highlightCodeBlocks } from "./highlight-code";
import { resolveImageUrls } from "./resolve-image-urls";
import type { NoteSlug } from "./note-slug.vo";
import type { Root, RootContent } from "mdast";

const parser = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm);

const isNotYamlNode = (node: RootContent): boolean => node.type !== "yaml";

export function markdownToMdast(content: string, slug: NoteSlug): Root {
  const tree = parser.parse(content);

  const filteredTree: Root = {
    ...tree,
    children: tree.children.filter((node) => isNotYamlNode(node)),
  };

  const withResolvedImages = resolveImageUrls(filteredTree, slug);
  return highlightCodeBlocks(withResolvedImages);
}
