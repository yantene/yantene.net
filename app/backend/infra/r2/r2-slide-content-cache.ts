import type { ISlideContentCache, SlideSlug } from "~/backend/domain/slide";
import type { CachedAsset } from "~/backend/domain/shared";

const JSON_CONTENT_TYPE = "application/json";
const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";
const DEFAULT_ASSET_CONTENT_TYPE = "application/octet-stream";

/** スライド 1 本の写しをまとめる接頭辞。 */
const CONTENT_KEY_PREFIX = "slides/";

/**
 * R2 をバックエンドにした {@link ISlideContentCache} 実装。
 * キーはスライド単位のプレフィックス `slides/<slug>/` 配下にまとめ、削除時は
 * プレフィックス列挙で一括削除できるようにする (記事と同じ形)。
 */
export class R2SlideContentCache implements ISlideContentCache {
  constructor(private readonly bucket: R2Bucket) {}

  private prefix(slug: SlideSlug): string {
    return `${CONTENT_KEY_PREFIX}${slug.toString()}/`;
  }

  private sourceKey(slug: SlideSlug): string {
    return `${this.prefix(slug)}source.md`;
  }

  private mdastKey(slug: SlideSlug): string {
    return `${this.prefix(slug)}mdast.json`;
  }

  private assetKey(slug: SlideSlug, path: string): string {
    return `${this.prefix(slug)}assets/${path}`;
  }

  async putSource(slug: SlideSlug, markdown: string): Promise<void> {
    await this.bucket.put(this.sourceKey(slug), markdown, {
      httpMetadata: { contentType: MARKDOWN_CONTENT_TYPE },
    });
  }

  async getSource(slug: SlideSlug): Promise<string | undefined> {
    const object = await this.bucket.get(this.sourceKey(slug));
    if (object === null) return undefined;
    return object.text();
  }

  async putMdast(slug: SlideSlug, mdast: unknown): Promise<void> {
    await this.bucket.put(this.mdastKey(slug), JSON.stringify(mdast), {
      httpMetadata: { contentType: JSON_CONTENT_TYPE },
    });
  }

  async getMdast(slug: SlideSlug): Promise<unknown> {
    const object = await this.bucket.get(this.mdastKey(slug));
    if (object === null) return undefined;
    return JSON.parse(await object.text());
  }

  async putAsset(slug: SlideSlug, path: string, asset: CachedAsset): Promise<void> {
    await this.bucket.put(this.assetKey(slug, path), asset.bytes, {
      httpMetadata: { contentType: asset.contentType },
    });
  }

  async getAsset(slug: SlideSlug, path: string): Promise<CachedAsset | undefined> {
    const object = await this.bucket.get(this.assetKey(slug, path));
    if (object === null) return undefined;
    return {
      bytes: new Uint8Array(await object.arrayBuffer()),
      contentType: object.httpMetadata?.contentType ?? DEFAULT_ASSET_CONTENT_TYPE,
    };
  }

  /** 行き場を失ったアセットの写しを片付ける。`keep` に無い名前だけを消す。 */
  async pruneAssets(slug: SlideSlug, keep: ReadonlySet<string>): Promise<void> {
    await this.deleteUnder(this.assetKey(slug, ""), keep);
  }

  async deleteSlide(slug: SlideSlug): Promise<void> {
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
