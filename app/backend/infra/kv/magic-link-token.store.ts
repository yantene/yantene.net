import type { IMagicLinkTokenStore } from "~/backend/domain/auth/magic-link";

interface MagicLinkPayload {
  readonly email: string;
  readonly issuedAt: number;
}

export class KvMagicLinkTokenStore implements IMagicLinkTokenStore {
  private static readonly prefix = "magic-link:";
  private static readonly ttlSeconds = 15 * 60; // 15 分

  constructor(private readonly kv: KVNamespace) {}

  async issue(email: string): Promise<string> {
    const token = crypto.randomUUID();
    const payload: MagicLinkPayload = {
      email,
      issuedAt: Date.now(),
    };
    await this.kv.put(
      `${KvMagicLinkTokenStore.prefix}${token}`,
      JSON.stringify(payload),
      { expirationTtl: KvMagicLinkTokenStore.ttlSeconds },
    );
    return token;
  }

  async consume(token: string): Promise<undefined | { email: string }> {
    const key = `${KvMagicLinkTokenStore.prefix}${token}`;
    const raw = await this.kv.get(key);
    if (raw === null) return undefined;

    // use-once: 取り出したら即削除
    await this.kv.delete(key);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // 破損データは無効なトークンとして静かに弾く。
      return undefined;
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("email" in parsed) ||
      typeof (parsed as Record<string, unknown>).email !== "string"
    ) {
      return undefined;
    }
    return { email: (parsed as MagicLinkPayload).email };
  }
}
