import { adminSessionKey, recordToAdminSession } from "./admin-session-record";
import type {
  AdminSession,
  AdminSessionId,
  IAdminSessionQueryRepository,
} from "~/backend/domain/admin";

export class KvAdminSessionQueryRepository implements IAdminSessionQueryRepository {
  constructor(private readonly kv: KVNamespace) {}

  async findById(id: AdminSessionId): Promise<AdminSession | undefined> {
    const value = await this.kv.get(adminSessionKey(id), "json");
    // KV は無いキーを null で返す。期限切れも同じ扱いになる。
    if (value === null) return undefined;

    return recordToAdminSession(id, value);
  }
}
