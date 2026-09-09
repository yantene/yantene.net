import type { ArticleSlug, CachedAsset, IArticleContentCache } from "~/backend/domain/article";

const JSON_CONTENT_TYPE = "application/json";
const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";
const DEFAULT_ASSET_CONTENT_TYPE = "application/octet-stream";

/** 記事 1 本の写しをまとめる接頭辞。 */
const CONTENT_KEY_PREFIX = "articles/";

/**
 * 改名前の接頭辞 (ADR 0033)。**写し終えたら消す移行コード (#430)。**
 *
 * 鍵を一度に切り替えると、force refresh が写し直すまで全記事の原文と MDAST が見つからず、
 * 記事ページが 500 になる。読むときはこちらへも降り、書くのは新しい接頭辞だけにして、
 * 片付けのときに古い写しを消す。force refresh で処理できた記事の旧鍵は消えるが、
 * skipped の記事は片付けまで来ないので残る。消す前に一覧で確かめること。
 */
const FORMER_CONTENT_KEY_PREFIX = "notes/";

/**
 * R2 をバックエンドにした {@link IArticleContentCache} 実装。
 * キーは記事単位のプレフィックス `articles/<slug>/` 配下にまとめ、削除時は
 * プレフィックス列挙で一括削除できるようにする。
 */
export class R2ArticleContentCache implements IArticleContentCache {
  constructor(private readonly bucket: R2Bucket) {}

  private prefix(slug: ArticleSlug): string {
    return `${CONTENT_KEY_PREFIX}${slug.toString()}/`;
  }

  private formerPrefix(slug: ArticleSlug): string {
    return `${FORMER_CONTENT_KEY_PREFIX}${slug.toString()}/`;
  }

  private sourceKey(prefix: string): string {
    return `${prefix}source.md`;
  }

  private mdastKey(prefix: string): string {
    return `${prefix}mdast.json`;
  }

  private assetKey(prefix: string, path: string): string {
    return `${prefix}assets/${path}`;
  }

  /**
   * 新しい接頭辞の鍵を読み、無ければ改名前の鍵に降りる。
   *
   * 新しい方を先に見るのは、写し直した記事が古い写しを出さないようにするため。
   */
  private async getWithFallback(
    slug: ArticleSlug,
    key: (prefix: string) => string,
  ): Promise<R2ObjectBody | null> {
    const current = await this.bucket.get(key(this.prefix(slug)));
    if (current !== null) return current;
    return this.bucket.get(key(this.formerPrefix(slug)));
  }

  async putSource(slug: ArticleSlug, markdown: string): Promise<void> {
    await this.bucket.put(this.sourceKey(this.prefix(slug)), markdown, {
      httpMetadata: { contentType: MARKDOWN_CONTENT_TYPE },
    });
  }

  async getSource(slug: ArticleSlug): Promise<string | undefined> {
    const object = await this.getWithFallback(slug, (prefix) => this.sourceKey(prefix));
    if (object === null) return undefined;
    return object.text();
  }

  async putMdast(slug: ArticleSlug, mdast: unknown): Promise<void> {
    await this.bucket.put(this.mdastKey(this.prefix(slug)), JSON.stringify(mdast), {
      httpMetadata: { contentType: JSON_CONTENT_TYPE },
    });
  }

  async getMdast(slug: ArticleSlug): Promise<unknown> {
    const object = await this.getWithFallback(slug, (prefix) => this.mdastKey(prefix));
    if (object === null) return undefined;
    return JSON.parse(await object.text());
  }

  async putAsset(slug: ArticleSlug, path: string, asset: CachedAsset): Promise<void> {
    await this.bucket.put(this.assetKey(this.prefix(slug), path), asset.bytes, {
      httpMetadata: { contentType: asset.contentType },
    });
  }

  async getAsset(slug: ArticleSlug, path: string): Promise<CachedAsset | undefined> {
    const object = await this.getWithFallback(slug, (prefix) => this.assetKey(prefix, path));
    if (object === null) return undefined;
    return {
      bytes: new Uint8Array(await object.arrayBuffer()),
      contentType: object.httpMetadata?.contentType ?? DEFAULT_ASSET_CONTENT_TYPE,
    };
  }

  /**
   * 行き場を失った写しを片付ける。
   *
   * 改名前の接頭辞の下も片付ける。原文と MDAST は refresh がここへ来る前に新しい鍵へ
   * 書き終えているので無条件に消す。アセットは、**新しい鍵に写せたものだけ**消す。
   * 正本に在るのに今回読めなかったアセット (`keep` に在って新しい鍵に無いもの) は、
   * 旧鍵の写しが唯一の写しなので残す (一時的な失敗で前回の写しを落とさない)。
   */
  async pruneAssets(slug: ArticleSlug, keep: ReadonlySet<string>): Promise<void> {
    const copied = await this.deleteUnder(this.assetKey(this.prefix(slug), ""), keep);
    const notYetCopied = [...keep].filter((path) => !copied.has(path));
    await this.deleteUnder(
      this.formerPrefix(slug),
      new Set(notYetCopied.map((path) => this.assetKey("", path))),
    );
  }

  async deleteArticle(slug: ArticleSlug): Promise<void> {
    await this.deleteUnder(this.prefix(slug));
    await this.deleteUnder(this.formerPrefix(slug));
  }

  /**
   * その前置の下を消す。`keep` に前置を落とした名前があるものは残す。残した名前を返す。
   *
   * 列挙は頁に分かれて返るので cursor を辿る。**残したものは次の頁でも列挙されない**
   * (cursor は列挙の位置であって、消した件数ではない) ので、辿り方は消す・残すに
   * よらず同じでよい。
   */
  private async deleteUnder(
    prefix: string,
    keep: ReadonlySet<string> = new Set(),
  ): Promise<ReadonlySet<string>> {
    const kept = new Set<string>();
    let cursor: string | undefined;
    do {
      const listing = await this.bucket.list({ prefix, cursor });
      const names = listing.objects.map((object) => object.key.slice(prefix.length));
      const stale = names.filter((name) => !keep.has(name));
      for (const name of names) if (keep.has(name)) kept.add(name);
      if (stale.length > 0) await this.bucket.delete(stale.map((name) => `${prefix}${name}`));
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor !== undefined);
    return kept;
  }
}
