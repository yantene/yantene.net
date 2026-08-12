import type { Session } from "./session.entity";

export interface ISessionCommandRepository {
  /** セッションを保存する。寿命は保存のたびに延びる (SESSION_LIFETIME_DAYS)。 */
  save(session: Session): Promise<void>;
}
