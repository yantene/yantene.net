import { resolveAssetUrlAgainst } from "./asset-url";

/**
 * 作品内の相対的なアセット URL (画像・リンク) をアセット API URL (ルート相対) に解決する。
 * 解決の仕方そのものは asset-url.ts にあり、ここは作品の入口を与えるだけ。
 */

/** 解決の基準になる、その作品のアセットの入口。 */
export function workAssetPrefixOf(slug: string): string {
  return `/api/v1/works/${slug}/assets/`;
}

export function resolveWorkAssetUrl(slug: string, url: string): string {
  return resolveAssetUrlAgainst(workAssetPrefixOf(slug), url);
}
