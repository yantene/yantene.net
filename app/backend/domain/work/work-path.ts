/** 作品ページの URL 接頭辞。`/works/<slug>`。 */
export const WORK_PATH_PREFIX = "/works/";

/** 作品ページのパス (`/works/<slug>`)。 */
export function workPath(slug: string): string {
  return `${WORK_PATH_PREFIX}${slug}`;
}
