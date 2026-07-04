import type { ISessionStore } from "~/backend/domain/shared";

interface Session {
  readonly userId: string;
  readonly createdAt: number;
}

export class KvSessionStore implements ISessionStore {
  private static readonly prefix = "session:";
  private static readonly ttlSeconds = 30 * 24 * 60 * 60; // 30 days

  constructor(private readonly kv: KVNamespace) {}

  async create(userId: string): Promise<string> {
    const sessionId = crypto.randomUUID();
    const session: Session = {
      userId,
      createdAt: Date.now(),
    };
    await this.kv.put(
      `${KvSessionStore.prefix}${sessionId}`,
      JSON.stringify(session),
      { expirationTtl: KvSessionStore.ttlSeconds },
    );
    return sessionId;
  }

  async get(sessionId: string): Promise<Session | undefined> {
    const raw = await this.kv.get(`${KvSessionStore.prefix}${sessionId}`);
    if (raw === null) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // 破損データは無効なセッションとして静かに弾く (500 を撒かない)。
      return undefined;
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("userId" in parsed) ||
      typeof (parsed as Record<string, unknown>).userId !== "string"
    ) {
      return undefined;
    }
    return parsed as Session;
  }

  async delete(sessionId: string): Promise<void> {
    await this.kv.delete(`${KvSessionStore.prefix}${sessionId}`);
  }
}
