import type { SessionId } from "./session-id.vo";
import type { Session } from "./session.entity";

export interface ISessionQueryRepository {
  /**
   * 識別子でセッションを引く。
   *
   * 無ければ undefined。期限が切れたか、そもそも発行していない識別子を渡された場合で、
   * どちらも「新しく起こす」で扱えるので区別しない。
   */
  findById(id: SessionId): Promise<Session | undefined>;
}
