import type { ILinkCardAssetCache, LinkCardAsset } from "~/backend/domain/link-card";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/**
 * R2 をバックエンドにした {@link ILinkCardAssetCache} 実装。
 * キーはカード単位のプレフィックス `link-cards/<id>/` 配下にまとめ、
 * 取り直しの前にプレフィックス列挙で一括削除できるようにする。
 */
export class R2LinkCardAssetCache implements ILinkCardAssetCache {
  constructor(private readonly bucket: R2Bucket) {}

  private prefix(id: string): string {
    return `link-cards/${id}/`;
  }

  private key(id: string, kind: "image" | "favicon"): string {
    return `${this.prefix(id)}${kind}`;
  }

  private async put(id: string, kind: "image" | "favicon", asset: LinkCardAsset): Promise<void> {
    await this.bucket.put(this.key(id, kind), asset.bytes as ArrayBufferView, {
      httpMetadata: { contentType: asset.contentType },
    });
  }

  private async get(id: string, kind: "image" | "favicon"): Promise<LinkCardAsset | undefined> {
    const object = await this.bucket.get(this.key(id, kind));
    if (object === null) return undefined;
    return {
      bytes: new Uint8Array(await object.arrayBuffer()),
      contentType: object.httpMetadata?.contentType ?? DEFAULT_CONTENT_TYPE,
    };
  }

  putImage(id: string, asset: LinkCardAsset): Promise<void> {
    return this.put(id, "image", asset);
  }

  putFavicon(id: string, asset: LinkCardAsset): Promise<void> {
    return this.put(id, "favicon", asset);
  }

  getImage(id: string): Promise<LinkCardAsset | undefined> {
    return this.get(id, "image");
  }

  getFavicon(id: string): Promise<LinkCardAsset | undefined> {
    return this.get(id, "favicon");
  }

  async deleteAssets(id: string): Promise<void> {
    const prefix = this.prefix(id);
    let cursor: string | undefined;
    do {
      const listing = await this.bucket.list({ prefix, cursor });
      const keys = listing.objects.map((object) => object.key);
      if (keys.length > 0) await this.bucket.delete(keys);
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor !== undefined);
  }
}
