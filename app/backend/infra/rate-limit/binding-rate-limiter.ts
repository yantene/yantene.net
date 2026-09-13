import type { IRateLimiter } from "~/backend/domain/auth";

/**
 * Cloudflare の Rate Limiting バインディングで連打を止める実装。
 *
 * **窓は 10 秒か 60 秒しか選べない** ので、担えるのは瞬間的な連打まで。受信箱を
 * 埋めさせない側の上限は、生きているトークンの本数で別に持つ (ADR 0039)。
 */
export class BindingRateLimiter implements IRateLimiter {
  constructor(private readonly binding: RateLimit) {}

  async allow(key: string): Promise<boolean> {
    const { success } = await this.binding.limit({ key });
    return success;
  }
}
