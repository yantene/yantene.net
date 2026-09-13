import type { AuthSessionId } from "./auth-session-id.vo";
import type { AuthSession } from "./auth-session.entity";

export interface IAuthSessionCommandRepository {
  /** セッションを保存し、期限を引き直す。 */
  save(session: AuthSession): Promise<void>;
  /** ログアウト。 */
  remove(id: AuthSessionId): Promise<void>;
}
