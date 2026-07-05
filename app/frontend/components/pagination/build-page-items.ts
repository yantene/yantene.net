/**
 * ページ項目。ellipsis はどのページの後ろの隙間かを `after` に持たせ、
 * React の key を安定・一意にする (配列 index を key に使わない)。
 */
export type PageItem =
  | { readonly type: "page"; readonly page: number }
  | { readonly type: "ellipsis"; readonly after: number };

/**
 * 表示するページ項目を組み立てる。先頭・末尾は常に出し、現在ページの前後 1 件を
 * 窓として出す。間が空くところは省略記号を挟む。
 */
export function buildPageItems(page: number, totalPages: number): PageItem[] {
  const wanted = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const visible = [...wanted]
    .filter((p) => p >= 1 && p <= totalPages)
    .toSorted((a, b) => a - b);

  const items: PageItem[] = [];
  let previous = 0;
  for (const p of visible) {
    if (previous !== 0 && p - previous > 1) {
      items.push({ type: "ellipsis", after: previous });
    }
    items.push({ type: "page", page: p });
    previous = p;
  }
  return items;
}
