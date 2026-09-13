import type { IWorkContentCache, WorkSlug } from "~/backend/domain/work";
import type { CachedAsset } from "~/backend/domain/shared";

const JSON_CONTENT_TYPE = "application/json";
const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";
const DEFAULT_ASSET_CONTENT_TYPE = "application/octet-stream";

/** 作品 1 件の写しをまとめる接頭辞。 */
const CONTENT_KEY_PREFIX = "works/";

/**
 * R2 をバックエンドにした {@link IWorkContentCache} 実装。
 * キーは作品単位のプレフィックス `works/<slug>/` 配下にまとめ、削除時は
 * プレフィックス列挙で一括削除できるようにする (記事と同じ形)。
 */
export class R2WorkContentCache implements IWorkContentCache {
  constructor(private readonly bucket: R2Bucket) {}

  private prefix(slug: WorkSlug): string {
    return `${CONTENT_KEY_PREFIX}${slug.toString()}/`;
  }

  private sourceKey(slug: WorkSlug): string {
    return `${this.prefix(slug)}source.md`;
  }

  private mdastKey(slug: WorkSlug): string {
    return `${this.prefix(slug)}mdast.json`;
  }

  private assetKey(slug: WorkSlug, path: string): string {
    return `${this.prefix(slug)}assets/${path}`;
  }

  async putSource(slug: WorkSlug, markdown: string): Promise<void> {
    await this.bucket.put(this.sourceKey(slug), markdown, {
      httpMetadata: { contentType: MARKDOWN_CONTENT_TYPE },
    });
  }

  async getSource(slug: WorkSlug): Promise<string | undefined> {
    const object = await this.bucket.get(this.sourceKey(slug));
    if (object === null) return undefined;
    return object.text();
  }

  async putMdast(slug: WorkSlug, mdast: unknown): Promise<void> {
    await this.bucket.put(this.mdastKey(slug), JSON.stringify(mdast), {
      httpMetadata: { contentType: JSON_CONTENT_TYPE },
    });
  }

  async getMdast(slug: WorkSlug): Promise<unknown> {
    const object = await this.bucket.get(this.mdastKey(slug));
    if (object === null) return undefined;
    return JSON.parse(await object.text());
  }

  async putAsset(slug: WorkSlug, path: string, asset: CachedAsset): Promise<void> {
    await this.bucket.put(this.assetKey(slug, path), asset.bytes, {
      httpMetadata: { contentType: asset.contentType },
    });
  }

  async getAsset(slug: WorkSlug, path: string): Promise<CachedAsset | undefined> {
    const object = await this.bucket.get(this.assetKey(slug, path));
    if (object === null) return undefined;
    return {
      bytes: new Uint8Array(await object.arrayBuffer()),
      contentType: object.httpMetadata?.contentType ?? DEFAULT_ASSET_CONTENT_TYPE,
    };
  }

  /** 行き場を失ったアセットの写しを片付ける。`keep` に無い名前だけを消す。 */
  async pruneAssets(slug: WorkSlug, keep: ReadonlySet<string>): Promise<void> {
    await this.deleteUnder(this.assetKey(slug, ""), keep);
  }

  async deleteWork(slug: WorkSlug): Promise<void> {
    await this.deleteUnder(this.prefix(slug));
  }

  /**
   * その前置の下を消す。`keep` に前置を落とした名前があるものは残す。
   *
   * 列挙は頁に分かれて返るので cursor を辿る。**残したものは次の頁でも列挙されない**
   * (cursor は列挙の位置であって、消した件数ではない) ので、辿り方は消す・残すに
   * よらず同じでよい。
   */
  private async deleteUnder(prefix: string, keep: ReadonlySet<string> = new Set()): Promise<void> {
    let cursor: string | undefined;
    do {
      const listing = await this.bucket.list({ prefix, cursor });
      const stale = listing.objects
        .map((object) => object.key.slice(prefix.length))
        .filter((name) => !keep.has(name));
      if (stale.length > 0) await this.bucket.delete(stale.map((name) => `${prefix}${name}`));
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor !== undefined);
  }
}
