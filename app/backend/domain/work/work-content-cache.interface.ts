import type { WorkSlug } from "./work-slug.vo";
import type { CachedAsset } from "~/backend/domain/shared";

/**
 * 作品の詳しい説明 (原文 Markdown・パース済み MDAST) と画像アセットのキャッシュ。
 * 通常リクエストはこのキャッシュから配信し、コンテンツリポジトリには触らない。
 * ドメインはストレージ技術 (R2) を知らない。infra が実装する。
 */
export interface IWorkContentCache {
  /** 原文の Markdown (フロントマターを含む、書かれたそのまま) を保存する。 */
  putSource(slug: WorkSlug, markdown: string): Promise<void>;
  /** 原文の Markdown を取得する。無ければ undefined。 */
  getSource(slug: WorkSlug): Promise<string | undefined>;

  /** パース済み MDAST (JSON 化可能なオブジェクト) を保存する。 */
  putMdast(slug: WorkSlug, mdast: unknown): Promise<void>;
  /** パース済み MDAST を取得する。無ければ undefined (unknown に含まれる)。 */
  getMdast(slug: WorkSlug): Promise<unknown>;

  /** 画像アセットを保存する (path は作品内の相対パス)。 */
  putAsset(slug: WorkSlug, path: string, asset: CachedAsset): Promise<void>;
  /** 画像アセットを取得する。無ければ undefined。 */
  getAsset(slug: WorkSlug, path: string): Promise<CachedAsset | undefined>;

  /**
   * この作品のアセットのうち、`keep` に無いものを消す。
   *
   * リネーム・削除されたアセットの片付けに使う。**原文と MDAST は消さない。**
   * 消してから書き直す形にすると、途中で落ちたときに説明が消えたまま残る (#310)。
   */
  pruneAssets(slug: WorkSlug, keep: ReadonlySet<string>): Promise<void>;

  /** 作品のキャッシュ (原文・MDAST・全アセット) を削除する。コンテンツリポジトリから消えたとき用。 */
  deleteWork(slug: WorkSlug): Promise<void>;
}
