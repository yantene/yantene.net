import type {
  CachedAsset,
  INoteContentCache,
  NoteSlug,
} from "~/backend/domain/note";

const JSON_CONTENT_TYPE = "application/json";
const DEFAULT_ASSET_CONTENT_TYPE = "application/octet-stream";

/**
 * R2 をバックエンドにした {@link INoteContentCache} 実装。
 * キーはノート単位のプレフィックス `notes/<slug>/` 配下にまとめ、削除時は
 * プレフィックス列挙で一括削除できるようにする。
 */
export class R2NoteContentCache implements INoteContentCache {
  constructor(private readonly bucket: R2Bucket) {}

  private prefix(slug: NoteSlug): string {
    return `notes/${slug.toString()}/`;
  }

  private mdastKey(slug: NoteSlug): string {
    return `${this.prefix(slug)}mdast.json`;
  }

  private assetKey(slug: NoteSlug, path: string): string {
    return `${this.prefix(slug)}assets/${path}`;
  }

  async putMdast(slug: NoteSlug, mdast: unknown): Promise<void> {
    await this.bucket.put(this.mdastKey(slug), JSON.stringify(mdast), {
      httpMetadata: { contentType: JSON_CONTENT_TYPE },
    });
  }

  async getMdast(slug: NoteSlug): Promise<unknown> {
    const object = await this.bucket.get(this.mdastKey(slug));
    if (object === null) return undefined;
    return JSON.parse(await object.text());
  }

  async putAsset(
    slug: NoteSlug,
    path: string,
    asset: CachedAsset,
  ): Promise<void> {
    await this.bucket.put(this.assetKey(slug, path), asset.bytes, {
      httpMetadata: { contentType: asset.contentType },
    });
  }

  async getAsset(
    slug: NoteSlug,
    path: string,
  ): Promise<CachedAsset | undefined> {
    const object = await this.bucket.get(this.assetKey(slug, path));
    if (object === null) return undefined;
    return {
      bytes: new Uint8Array(await object.arrayBuffer()),
      contentType:
        object.httpMetadata?.contentType ?? DEFAULT_ASSET_CONTENT_TYPE,
    };
  }

  async deleteNote(slug: NoteSlug): Promise<void> {
    const prefix = this.prefix(slug);
    let cursor: string | undefined;
    do {
      const listing = await this.bucket.list({ prefix, cursor });
      const keys = listing.objects.map((object) => object.key);
      if (keys.length > 0) await this.bucket.delete(keys);
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor !== undefined);
  }
}
