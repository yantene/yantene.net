/**
 * マジックリンク方式の一時トークンを管理するストア。
 *
 * - `issue(email)`: 新規トークンを発行し、永続化したうえで token 文字列を返す。
 *   発行後の有効期限はストア実装内に隠蔽する (KV の TTL など)。
 * - `consume(token)`: トークンを取り出して即削除 (use-once)。
 *   存在しない or 期限切れの場合は undefined を返す。
 */
export interface IMagicLinkTokenStore {
  issue(email: string): Promise<string>;
  consume(token: string): Promise<undefined | { email: string }>;
}
