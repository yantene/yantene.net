/**
 * プロフィール本文 (パース済み MDAST) のキャッシュ。
 * 通常リクエストはここから読み、コンテンツリポジトリには触らない (ADR 0034)。
 * ドメインはストレージ技術 (R2) を知らない。infra が実装する。
 *
 * **原文の Markdown は置かない。** 記事は `/articles/<slug>.md` で原文を配る約束が
 * あるが (ADR 0009)、プロフィールにその口は無い。読まれない写しを置くと、
 * 書き換えるたびに「どちらが本物か」を考えることになる。
 */
export interface IProfileContentCache {
  /** パース済み MDAST (JSON 化可能なオブジェクト) を保存する。 */
  putMdast(mdast: unknown): Promise<void>;
  /** パース済み MDAST を取得する。無ければ undefined (unknown に含まれる)。 */
  getMdast(): Promise<unknown>;
  /** 写しを消す。`profile.md` がコンテンツリポジトリから消えたとき用。 */
  delete(): Promise<void>;
}
