import type { AdminCredential } from "./admin-credential.entity";
import type { CredentialId } from "./credential-id.vo";

export interface IAdminCredentialCommandRepository {
  /** 新しい資格情報を保存する。すでに同じ id があれば送出する。 */
  add(credential: AdminCredential): Promise<void>;
  /** 使用回数と最終使用時刻を書き戻す。 */
  save(credential: AdminCredential): Promise<void>;
  /** 資格情報を取り消す。 */
  remove(id: CredentialId): Promise<void>;
}
