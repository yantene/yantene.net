import type { NoteSlug } from "./note-slug.vo";

/** キャッシュされた画像アセット。 */
export interface CachedAsset {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

/**
 * ノート本文 (パース済み MDAST) と画像アセットのキャッシュ。
 * 通常リクエストはこのキャッシュから配信し、Artifacts には触らない (ADR 0005)。
 * ドメインはストレージ技術 (R2) を知らない。infra が実装する。
 */
export interface INoteContentCache {
  /** パース済み MDAST (JSON 化可能なオブジェクト) を保存する。 */
  putMdast(slug: NoteSlug, mdast: unknown): Promise<void>;
  /** パース済み MDAST を取得する。無ければ undefined (unknown に含まれる)。 */
  getMdast(slug: NoteSlug): Promise<unknown>;

  /** 画像アセットを保存する (path はノート内の相対パス)。 */
  putAsset(slug: NoteSlug, path: string, asset: CachedAsset): Promise<void>;
  /** 画像アセットを取得する。無ければ undefined。 */
  getAsset(slug: NoteSlug, path: string): Promise<CachedAsset | undefined>;

  /** ノートのキャッシュ (MDAST + 全アセット) を削除する。 */
  deleteNote(slug: NoteSlug): Promise<void>;
}
