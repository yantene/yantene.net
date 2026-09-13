/**
 * 短い窓での連打を止める口。
 *
 * **担えるのは瞬間的な連打まで。** 受信箱を埋めさせない側の上限は、生きている
 * トークンの本数で別に持つ (ADR 0039)。
 */
export interface IRateLimiter {
  /** 通してよければ true。 */
  allow(key: string): Promise<boolean>;
}
