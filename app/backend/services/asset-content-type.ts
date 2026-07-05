const contentTypes = new Map<string, string>([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["avif", "image/avif"],
  ["svg", "image/svg+xml"],
]);

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/** ファイルパスの拡張子から Content-Type を推定する (画像アセット向け)。 */
export function contentTypeForPath(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return DEFAULT_CONTENT_TYPE;
  const ext = path.slice(dot + 1).toLowerCase();
  return contentTypes.get(ext) ?? DEFAULT_CONTENT_TYPE;
}
