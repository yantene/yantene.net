import type {
  AuthSession,
  AuthSessionId,
  IAuthSessionQueryRepository,
} from "~/backend/domain/auth";
import { authSessionKey, recordToAuthSession } from "./auth-session-record";

export class KvAuthSessionQueryRepository implements IAuthSessionQueryRepository {
  constructor(private readonly kv: KVNamespace) {}

  async findById(id: AuthSessionId): Promise<AuthSession | undefined> {
    const value = await this.kv.get(authSessionKey(id), "json");
    // KV は無いキーを null で返す。期限切れも同じ扱いになる。
    if (value === null) return undefined;

    return recordToAuthSession(id, value);
  }
}
