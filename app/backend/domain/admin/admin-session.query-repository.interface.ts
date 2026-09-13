import type { AdminSessionId } from "./admin-session-id.vo";
import type { AdminSession } from "./admin-session.entity";

export interface IAdminSessionQueryRepository {
  /** 見つからない・期限切れなら undefined。 */
  findById(id: AdminSessionId): Promise<AdminSession | undefined>;
}
