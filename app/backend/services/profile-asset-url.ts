import { resolveAssetUrlAgainst } from "./asset-url";

/**
 * プロフィールの相対的なアセット URL (顔写真・本文の画像) をアセット API URL に解決する。
 * 解決の仕方そのものは asset-url.ts にあり、ここはプロフィールの入口を与えるだけ。
 */

/** 解決の基準になる、プロフィールのアセットの入口。 */
export const PROFILE_ASSET_PREFIX = "/api/v1/profile/assets/";

export function resolveProfileAssetUrl(url: string): string {
  return resolveAssetUrlAgainst(PROFILE_ASSET_PREFIX, url);
}
