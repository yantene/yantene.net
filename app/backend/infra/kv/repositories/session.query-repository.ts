import { recordToSession, sessionKey } from "./session-record";
import type {
  ISessionQueryRepository,
  Session,
  SessionId,
} from "~/backend/domain/session";

export class KvSessionQueryRepository implements ISessionQueryRepository {
  constructor(private readonly kv: KVNamespace) {}

  async findById(id: SessionId): Promise<Session | undefined> {
    const value = await this.kv.get(sessionKey(id), "json");
    // KV は無いキーを null で返す。期限切れも同じ扱いになる。
    if (value === null) return undefined;

    return recordToSession(id, value);
  }
}
