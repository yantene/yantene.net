import type {
  AuthSession,
  AuthSessionId,
  IAuthSessionCommandRepository,
} from "~/backend/domain/auth";
import { AUTH_SESSION_LIFETIME_DAYS } from "~/backend/domain/auth";
import { authSessionKey, authSessionToRecord } from "./auth-session-record";

const SECONDS_PER_DAY = 86_400;

export class KvAuthSessionCommandRepository implements IAuthSessionCommandRepository {
  constructor(private readonly kv: KVNamespace) {}

  /**
   * セッションを書き込む。期限は書くたびに引き直す。
   *
   * 触り続けている限り切れず、放っておけば 30 日で消える。cookie 側の Max-Age と
   * 同じ値を使い、「ブラウザには残っているのに記録が無い」状態を作らない。
   */
  async save(session: AuthSession): Promise<void> {
    await this.kv.put(authSessionKey(session.id), JSON.stringify(authSessionToRecord(session)), {
      expirationTtl: AUTH_SESSION_LIFETIME_DAYS * SECONDS_PER_DAY,
    });
  }

  async remove(id: AuthSessionId): Promise<void> {
    await this.kv.delete(authSessionKey(id));
  }
}
