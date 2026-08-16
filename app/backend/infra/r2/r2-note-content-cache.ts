import type {
  CachedAsset,
  INoteContentCache,
  NoteSlug,
} from "~/backend/domain/note";

const JSON_CONTENT_TYPE = "application/json";
const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";
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

  private sourceKey(slug: NoteSlug): string {
    return `${this.prefix(slug)}source.md`;
  }

  private mdastKey(slug: NoteSlug): string {
    return `${this.prefix(slug)}mdast.json`;
  }

  private assetKey(slug: NoteSlug, path: string): string {
    return `${this.prefix(slug)}assets/${path}`;
  }

  async putSource(slug: NoteSlug, markdown: string): Promise<void> {
    await this.bucket.put(this.sourceKey(slug), markdown, {
      httpMetadata: { contentType: MARKDOWN_CONTENT_TYPE },
    });
  }

  async getSource(slug: NoteSlug): Promise<string | undefined> {
    const object = await this.bucket.get(this.sourceKey(slug));
    if (object === null) return undefined;
    return object.text();
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

  async pruneAssets(slug: NoteSlug, keep: ReadonlySet<string>): Promise<void> {
    await this.deleteUnder(`${this.prefix(slug)}assets/`, keep);
  }

  async deleteNote(slug: NoteSlug): Promise<void> {
    await this.deleteUnder(this.prefix(slug));
  }

  /**
   * その前置の下を消す。`keep` に前置を落とした名前があるものは残す。
   *
   * 列挙は頁に分かれて返るので cursor を辿る。**残したものは次の頁でも列挙されない**
   * (cursor は列挙の位置であって、消した件数ではない) ので、辿り方は消す・残すに
   * よらず同じでよい。
   */
  private async deleteUnder(
    prefix: string,
    keep: ReadonlySet<string> = new Set(),
  ): Promise<void> {
    let cursor: string | undefined;
    do {
      const listing = await this.bucket.list({ prefix, cursor });
      const stale = listing.objects
        .map((object) => object.key)
        .filter((key) => !keep.has(key.slice(prefix.length)));
      if (stale.length > 0) await this.bucket.delete(stale);
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor !== undefined);
  }
}
