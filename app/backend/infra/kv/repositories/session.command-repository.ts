import { sessionKey, sessionToRecord } from "./session-record";
import type {
  ISessionCommandRepository,
  Session,
} from "~/backend/domain/session";
import { SESSION_LIFETIME_DAYS } from "~/backend/domain/session";

const SECONDS_PER_DAY = 86_400;

export class KvSessionCommandRepository implements ISessionCommandRepository {
  constructor(private readonly kv: KVNamespace) {}

  /**
   * セッションを書き込む。
   *
   * 期限は書くたびに引き直される。読み続けている人のセッションは切れず、
   * 来なくなった人のものは黙って消える (掃除の運用が要らない)。
   */
  async save(session: Session): Promise<void> {
    await this.kv.put(
      sessionKey(session.id),
      JSON.stringify(sessionToRecord(session)),
      { expirationTtl: SESSION_LIFETIME_DAYS * SECONDS_PER_DAY },
    );
  }
}
