import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { resolveImageUrls } from "./resolve-image-urls";
import type { NoteSlug } from "./note-slug.vo";
import type { Root, RootContent } from "mdast";

const parser = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]);

const isNotYamlNode = (node: RootContent): boolean => node.type !== "yaml";

export function markdownToMdast(content: string, slug: NoteSlug): Root {
  const tree = parser.parse(content);

  const filteredTree: Root = {
    ...tree,
    children: tree.children.filter((node) => isNotYamlNode(node)),
  };

  return resolveImageUrls(filteredTree, slug);
}
