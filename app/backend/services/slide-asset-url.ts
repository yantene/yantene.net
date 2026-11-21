import { resolveAssetUrlAgainst } from "./asset-url";

/**
 * スライド内の相対的なアセット URL (画像・リンク) をアセット API URL (ルート相対) に解決する。
 * 解決の仕方そのものは asset-url.ts にあり、ここはスライドの入口を与えるだけ。
 */

/** 解決の基準になる、そのスライドのアセットの入口。 */
export function slideAssetPrefixOf(slug: string): string {
  return `/api/v1/slides/${slug}/assets/`;
}

export function resolveSlideAssetUrl(slug: string, url: string): string {
  return resolveAssetUrlAgainst(slideAssetPrefixOf(slug), url);
}
