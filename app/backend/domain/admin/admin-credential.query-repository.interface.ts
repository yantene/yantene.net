import type { AdminCredential } from "./admin-credential.entity";
import type { CredentialId } from "./credential-id.vo";

export interface IAdminCredentialQueryRepository {
  findById(id: CredentialId): Promise<AdminCredential | undefined>;
  /** 登録済みの全件。管理画面の一覧に出す。 */
  list(): Promise<readonly AdminCredential[]>;
  /**
   * 登録済みの本数。
   *
   * 登録の入口を開けてよいかの判定に使う (0 本なら secret を示した要求だけ通す)。
   * 本数だけを引くのは、判定のために鍵そのものを読み出さないため。
   */
  count(): Promise<number>;
}
