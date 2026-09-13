import type { CachedAsset } from "~/backend/domain/shared";

/**
 * プロフィールの長い自己紹介 (原文 Markdown・パース済み MDAST) と顔写真のキャッシュ。
 *
 * 記事と同じ置き方だが、プロフィールは 1 つしかないのでスラグを取らない。通常リクエストは
 * このキャッシュから配信し、コンテンツリポジトリには触らない。
 */
export interface IProfileContentCache {
  /** 原文の Markdown (フロントマターを含む、書かれたそのまま) を保存する。 */
  putSource(markdown: string): Promise<void>;
  /** 原文の Markdown を取得する。無ければ undefined。 */
  getSource(): Promise<string | undefined>;

  /** パース済み MDAST (JSON 化可能なオブジェクト) を保存する。 */
  putMdast(mdast: unknown): Promise<void>;
  /** パース済み MDAST を取得する。無ければ undefined (unknown に含まれる)。 */
  getMdast(): Promise<unknown>;

  /** アセットを保存する (path は `profile/` 以下の相対パス)。 */
  putAsset(path: string, asset: CachedAsset): Promise<void>;
  /** アセットを取得する。無ければ undefined。 */
  getAsset(path: string): Promise<CachedAsset | undefined>;

  /**
   * アセットのうち `keep` に無いものを消す。
   *
   * **原文と MDAST は消さない。** 消してから書き直す形にすると、途中で落ちたときに
   * プロフィールが消えたまま残る (記事と同じ #310 の決め)。
   */
  pruneAssets(keep: ReadonlySet<string>): Promise<void>;

  /** プロフィールのキャッシュ (原文・MDAST・全アセット) を削除する。 */
  deleteProfile(): Promise<void>;
}
