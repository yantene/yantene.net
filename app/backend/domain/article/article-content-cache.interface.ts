import type { NoteSlug } from "./note-slug.vo";

/** キャッシュされた画像アセット。 */
export interface CachedAsset {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

/**
 * ノート本文 (原文 Markdown・パース済み MDAST) と画像アセットのキャッシュ。
 * 通常リクエストはこのキャッシュから配信し、正本には触らない (ADR 0004)。
 * ドメインはストレージ技術 (R2) を知らない。infra が実装する。
 */
export interface INoteContentCache {
  /** 原文の Markdown (フロントマターを含む正本そのもの) を保存する。 */
  putSource(slug: NoteSlug, markdown: string): Promise<void>;
  /** 原文の Markdown を取得する。無ければ undefined。 */
  getSource(slug: NoteSlug): Promise<string | undefined>;

  /** パース済み MDAST (JSON 化可能なオブジェクト) を保存する。 */
  putMdast(slug: NoteSlug, mdast: unknown): Promise<void>;
  /** パース済み MDAST を取得する。無ければ undefined (unknown に含まれる)。 */
  getMdast(slug: NoteSlug): Promise<unknown>;

  /** 画像アセットを保存する (path はノート内の相対パス)。 */
  putAsset(slug: NoteSlug, path: string, asset: CachedAsset): Promise<void>;
  /** 画像アセットを取得する。無ければ undefined。 */
  getAsset(slug: NoteSlug, path: string): Promise<CachedAsset | undefined>;

  /**
   * このノートのアセットのうち、`keep` に無いものを消す。
   *
   * リネーム・削除されたアセットの片付けに使う。**原文と MDAST は消さない。**
   * 消してから書き直す形にすると、途中で落ちたときに記事が消えたまま残る (#310)。
   */
  pruneAssets(slug: NoteSlug, keep: ReadonlySet<string>): Promise<void>;

  /** ノートのキャッシュ (原文・MDAST・全アセット) を削除する。正本から消えたとき用。 */
  deleteNote(slug: NoteSlug): Promise<void>;
}
