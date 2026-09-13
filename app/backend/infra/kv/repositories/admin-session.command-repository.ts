import { adminSessionKey, adminSessionToRecord } from "./admin-session-record";
import type {
  AdminSession,
  AdminSessionId,
  IAdminSessionCommandRepository,
} from "~/backend/domain/admin";
import { ADMIN_SESSION_LIFETIME_DAYS } from "~/backend/domain/admin";

const SECONDS_PER_DAY = 86_400;

export class KvAdminSessionCommandRepository implements IAdminSessionCommandRepository {
  constructor(private readonly kv: KVNamespace) {}

  /**
   * セッションを書き込む。期限は書くたびに引き直す。
   *
   * 触り続けている限り切れず、放っておけば 14 日で消える。cookie 側の Max-Age と
   * 同じ値を使い、「ブラウザには残っているのに記録が無い」状態を作らない。
   */
  async save(session: AdminSession): Promise<void> {
    await this.kv.put(adminSessionKey(session.id), JSON.stringify(adminSessionToRecord(session)), {
      expirationTtl: ADMIN_SESSION_LIFETIME_DAYS * SECONDS_PER_DAY,
    });
  }

  async remove(id: AdminSessionId): Promise<void> {
    await this.kv.delete(adminSessionKey(id));
  }
}
