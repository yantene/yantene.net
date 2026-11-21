import type { SlideSlug } from "./slide-slug.vo";
import type { CachedAsset } from "~/backend/domain/shared";

/**
 * スライドの本文 (原文 Markdown・パース済み MDAST) と画像アセットのキャッシュ。
 * 通常リクエストはこのキャッシュから配信し、コンテンツリポジトリには触らない。
 * ドメインはストレージ技術 (R2) を知らない。infra が実装する。
 */
export interface ISlideContentCache {
  /** 原文の Markdown (フロントマターを含む、書かれたそのまま) を保存する。 */
  putSource(slug: SlideSlug, markdown: string): Promise<void>;
  /** 原文の Markdown を取得する。無ければ undefined。 */
  getSource(slug: SlideSlug): Promise<string | undefined>;

  /** パース済み MDAST (JSON 化可能なオブジェクト) を保存する。 */
  putMdast(slug: SlideSlug, mdast: unknown): Promise<void>;
  /** パース済み MDAST を取得する。無ければ undefined (unknown に含まれる)。 */
  getMdast(slug: SlideSlug): Promise<unknown>;

  /** 画像アセットを保存する (path はスライド内の相対パス)。 */
  putAsset(slug: SlideSlug, path: string, asset: CachedAsset): Promise<void>;
  /** 画像アセットを取得する。無ければ undefined。 */
  getAsset(slug: SlideSlug, path: string): Promise<CachedAsset | undefined>;

  /**
   * このスライドのアセットのうち、`keep` に無いものを消す。
   *
   * リネーム・削除されたアセットの片付けに使う。**原文と MDAST は消さない。**
   * 消してから書き直す形にすると、途中で落ちたときに本文が消えたまま残る (#310)。
   */
  pruneAssets(slug: SlideSlug, keep: ReadonlySet<string>): Promise<void>;

  /** スライドのキャッシュ (原文・MDAST・全アセット) を削除する。コンテンツリポジトリから消えたとき用。 */
  deleteSlide(slug: SlideSlug): Promise<void>;
}
