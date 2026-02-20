import { visit } from "unist-util-visit";
import type { NoteSlug } from "./note-slug.vo";
import type { Image, Root } from "mdast";

const isAbsoluteUrl = (url: string): boolean =>
  url.startsWith("/") ||
  url.startsWith("http://") ||
  url.startsWith("https://");

const normalizePath = (path: string): string =>
  path.startsWith("./") ? path.slice(2) : path;

const toAssetApiUrl = (slug: NoteSlug, relativePath: string): string =>
  `/api/v1/notes/${slug.value}/assets/${normalizePath(relativePath)}`;

export function resolveImageUrls(tree: Root, slug: NoteSlug): Root {
  const cloned = structuredClone(tree);

  visit(cloned, "image", (node: Image) => {
    if (!isAbsoluteUrl(node.url)) {
      node.url = toAssetApiUrl(slug, node.url);
    }
  });

  return cloned;
}
