import type { IProfileContentCache } from "~/backend/domain/profile";
import type { CachedAsset } from "~/backend/domain/shared";

const JSON_CONTENT_TYPE = "application/json";
const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";
const DEFAULT_ASSET_CONTENT_TYPE = "application/octet-stream";

/** プロフィールの写しをまとめる接頭辞。記事は `articles/<slug>/` の下に置く。 */
const CONTENT_KEY_PREFIX = "profile/";

/**
 * R2 をバックエンドにした {@link IProfileContentCache} 実装。
 *
 * プロフィールは 1 つしかないので、記事と違ってスラグの段が要らない。キーは
 * `profile/` 配下にまとめ、削除はプレフィックス列挙で一括で行う。
 */
export class R2ProfileContentCache implements IProfileContentCache {
  constructor(private readonly bucket: R2Bucket) {}

  private get sourceKey(): string {
    return `${CONTENT_KEY_PREFIX}source.md`;
  }

  private get mdastKey(): string {
    return `${CONTENT_KEY_PREFIX}mdast.json`;
  }

  private assetKey(path: string): string {
    return `${CONTENT_KEY_PREFIX}assets/${path}`;
  }

  async putSource(markdown: string): Promise<void> {
    await this.bucket.put(this.sourceKey, markdown, {
      httpMetadata: { contentType: MARKDOWN_CONTENT_TYPE },
    });
  }

  async getSource(): Promise<string | undefined> {
    const object = await this.bucket.get(this.sourceKey);
    if (object === null) return undefined;
    return object.text();
  }

  async putMdast(mdast: unknown): Promise<void> {
    await this.bucket.put(this.mdastKey, JSON.stringify(mdast), {
      httpMetadata: { contentType: JSON_CONTENT_TYPE },
    });
  }

  async getMdast(): Promise<unknown> {
    const object = await this.bucket.get(this.mdastKey);
    if (object === null) return undefined;
    return JSON.parse(await object.text());
  }

  async putAsset(path: string, asset: CachedAsset): Promise<void> {
    await this.bucket.put(this.assetKey(path), asset.bytes, {
      httpMetadata: { contentType: asset.contentType },
    });
  }

  async getAsset(path: string): Promise<CachedAsset | undefined> {
    const object = await this.bucket.get(this.assetKey(path));
    if (object === null) return undefined;
    return {
      bytes: new Uint8Array(await object.arrayBuffer()),
      contentType: object.httpMetadata?.contentType ?? DEFAULT_ASSET_CONTENT_TYPE,
    };
  }

  /** 行き場を失ったアセットの写しを片付ける。`keep` に無い名前だけを消す。 */
  async pruneAssets(keep: ReadonlySet<string>): Promise<void> {
    await this.deleteUnder(this.assetKey(""), keep);
  }

  async deleteProfile(): Promise<void> {
    await this.deleteUnder(CONTENT_KEY_PREFIX);
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
