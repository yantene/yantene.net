import type { AuthSessionId } from "./auth-session-id.vo";
import type { AuthSession } from "./auth-session.entity";

export interface IAuthSessionQueryRepository {
  /** 見つからない・期限切れなら undefined。 */
  findById(id: AuthSessionId): Promise<AuthSession | undefined>;
}
