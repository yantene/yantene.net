import type { ArticleSlug } from "./article-slug.vo";

/** キャッシュされた画像アセット。 */
export interface CachedAsset {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

/**
 * 記事本文 (原文 Markdown・パース済み MDAST) と画像アセットのキャッシュ。
 * 通常リクエストはこのキャッシュから配信し、コンテンツリポジトリには触らない (ADR 0004)。
 * ドメインはストレージ技術 (R2) を知らない。infra が実装する。
 */
export interface IArticleContentCache {
  /** 原文の Markdown (フロントマターを含むコンテンツリポジトリそのもの) を保存する。 */
  putSource(slug: ArticleSlug, markdown: string): Promise<void>;
  /** 原文の Markdown を取得する。無ければ undefined。 */
  getSource(slug: ArticleSlug): Promise<string | undefined>;

  /** パース済み MDAST (JSON 化可能なオブジェクト) を保存する。 */
  putMdast(slug: ArticleSlug, mdast: unknown): Promise<void>;
  /** パース済み MDAST を取得する。無ければ undefined (unknown に含まれる)。 */
  getMdast(slug: ArticleSlug): Promise<unknown>;

  /** 画像アセットを保存する (path は記事内の相対パス)。 */
  putAsset(slug: ArticleSlug, path: string, asset: CachedAsset): Promise<void>;
  /** 画像アセットを取得する。無ければ undefined。 */
  getAsset(slug: ArticleSlug, path: string): Promise<CachedAsset | undefined>;

  /**
   * この記事のアセットのうち、`keep` に無いものを消す。
   *
   * リネーム・削除されたアセットの片付けに使う。**原文と MDAST は消さない。**
   * 消してから書き直す形にすると、途中で落ちたときに記事が消えたまま残る (#310)。
   */
  pruneAssets(slug: ArticleSlug, keep: ReadonlySet<string>): Promise<void>;

  /** 記事のキャッシュ (原文・MDAST・全アセット) を削除する。コンテンツリポジトリから消えたとき用。 */
  deleteArticle(slug: ArticleSlug): Promise<void>;
}
