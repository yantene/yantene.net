/**
 * コンテンツ正本 (Markdown 本文・画像アセット) の読み取り口。
 * ドメインはストレージ技術 (Cloudflare Artifacts 等) を知らない。infra が実装する。
 *
 * 変更検出はコンテンツハッシュで行う: refresh 時にツリーを取得し、各ファイルの
 * ハッシュを D1 の保存済みと比較して、変わったファイルだけ読み直す (ADR 0005)。
 */

/** ツリー内の 1 ファイル。hash はそのファイル内容のリビジョン識別子。 */
export interface ContentEntry {
  /** 正本内のパス (例: "notes/my-note.md", "notes/my-note/cover.png")。 */
  readonly path: string;
  /** ファイル内容のハッシュ (変更検出用)。 */
  readonly hash: string;
}

export interface IContentStore {
  /** 全ファイルのパスとハッシュを列挙する (変更検出のためのスナップショット)。 */
  listTree(): Promise<readonly ContentEntry[]>;

  /**
   * パス指定でファイルの生バイト列を読む。存在しなければ undefined を返す。
   */
  readFile(path: string): Promise<Uint8Array | undefined>;
}
