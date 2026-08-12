import type { LinkCardAsset } from "./link-card-asset";

/** カードの画像を写して置いておく先。キーはカードの id。 */
export interface ILinkCardAssetCache {
  putImage(id: string, asset: LinkCardAsset): Promise<void>;
  putFavicon(id: string, asset: LinkCardAsset): Promise<void>;
  getImage(id: string): Promise<LinkCardAsset | undefined>;
  getFavicon(id: string): Promise<LinkCardAsset | undefined>;
  /** そのカードの画像をまとめて捨てる (取り直す前の掃除)。 */
  deleteAssets(id: string): Promise<void>;
}
