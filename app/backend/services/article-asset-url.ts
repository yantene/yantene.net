import { resolveAssetUrlAgainst } from "./asset-url";

/**
 * 記事内の相対的なアセット URL (画像・リンク) をアセット API URL (ルート相対) に解決する。
 * 解決の仕方そのものは asset-url.ts にあり、ここは記事の入口を与えるだけ。
 */

/** 解決の基準になる、その記事のアセットの入口。 */
export function assetPrefixOf(slug: string): string {
  return `/api/v1/articles/${slug}/assets/`;
}

export function resolveAssetUrl(slug: string, url: string): string {
  return resolveAssetUrlAgainst(assetPrefixOf(slug), url);
}
