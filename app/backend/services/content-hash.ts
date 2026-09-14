import type { ContentEntry } from "~/backend/domain/content";

/**
 * md + アセットの (path, hash) を合成した変更検出用ハッシュ。
 *
 * 記事もプロフィールも「1 つの Markdown と、その脇に置いたアセット」という同じ形を
 * しているので、同じ作り方で合成する。アセットを並べ替えてから混ぜるのは、ツリーの
 * 返す順に左右されないようにするため。
 */
export function computeContentHash(source: ContentEntry, assets: readonly ContentEntry[]): string {
  const sortedAssets = assets.toSorted((a, b) => a.path.localeCompare(b.path));
  const parts = [`${source.path}:${source.hash}`];
  for (const asset of sortedAssets) {
    parts.push(`${asset.path}:${asset.hash}`);
  }
  return fnv1a(parts.join("\n"));
}

/** FNV-1a 32-bit ハッシュ (16 進)。変更検出用途に十分。 */
function fnv1a(input: string): string {
  let hash = 0x81_1c_9d_c5;
  for (const ch of input) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
