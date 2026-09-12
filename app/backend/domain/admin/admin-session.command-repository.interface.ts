import type { AdminSessionId } from "./admin-session-id.vo";
import type { AdminSession } from "./admin-session.entity";

export interface IAdminSessionCommandRepository {
  /** セッションを保存し、期限を引き直す。 */
  save(session: AdminSession): Promise<void>;
  /** ログアウト。 */
  remove(id: AdminSessionId): Promise<void>;
}
