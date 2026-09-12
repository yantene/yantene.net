import type { CeremonyPurpose, Challenge, PasskeyCeremony } from "~/backend/domain/admin";

/** KV に置く形。 */
export interface PasskeyCeremonyRecord {
  readonly purpose: string;
}

/**
 * チャレンジを引くキー。
 *
 * **チャレンジそのものを鍵にする。** 別に識別子を配って cookie で運ぶ形にしても、
 * 守りは変わらない (どちらも 32 バイトの乱数を当てられないことが拠りどころ)。
 * 運ぶものを 1 つ減らす。
 */
export function ceremonyKey(challenge: Challenge): string {
  return `passkey-ceremony:${challenge.toString()}`;
}

export function recordToPurpose(value: unknown): CeremonyPurpose | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { purpose } = value as Record<string, unknown>;
  if (purpose === "registration" || purpose === "authentication") return purpose;
  return undefined;
}

export function ceremonyToRecord(ceremony: PasskeyCeremony): PasskeyCeremonyRecord {
  return { purpose: ceremony.purpose };
}
