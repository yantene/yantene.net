/** スライドのページの URL 接頭辞。`/slides/<slug>`。 */
export const SLIDE_PATH_PREFIX = "/slides/";

/** スライドのページのパス (`/slides/<slug>`)。 */
export function slidePath(slug: string): string {
  return `${SLIDE_PATH_PREFIX}${slug}`;
}
