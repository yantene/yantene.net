import { Temporal } from "@js-temporal/polyfill";
import type { AdminSessionId } from "~/backend/domain/admin";
import { AdminSession, CredentialId } from "~/backend/domain/admin";

/** KV に置く形。JSON にできる値だけで持つ。 */
export interface AdminSessionRecord {
  readonly credentialId: string;
  readonly startedAt: string;
  readonly lastSeenAt: string;
}

/**
 * 管理者のセッションを引くキー。
 *
 * 読み手のセッション (`session:`) と同じ名前空間に置くので、接頭辞で分ける。
 * **識別子だけで引けてしまわないようにする**のが目的で、読み手の識別子を
 * 管理者のものとして差し出せない。
 */
export function adminSessionKey(id: AdminSessionId): string {
  return `admin-session:${id.toString()}`;
}

export function adminSessionToRecord(session: AdminSession): AdminSessionRecord {
  return {
    credentialId: session.credentialId.toString(),
    startedAt: session.startedAt.toString(),
    lastSeenAt: session.lastSeenAt.toString(),
  };
}

/**
 * KV から読んだ値をセッションに戻す。読めない形なら undefined。
 *
 * **読み手のセッションと違い、読めないものは起こし直さない。** あちらは記録が
 * 壊れても閲覧の数え方が狂うだけだが、こちらは権限そのもの。読めなければ
 * 「ログインしていない」に倒し、もう一度 passkey に触ってもらう。
 */
export function recordToAdminSession(id: AdminSessionId, value: unknown): AdminSession | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  const { credentialId, startedAt, lastSeenAt } = value as Record<string, unknown>;
  if (
    typeof credentialId !== "string" ||
    typeof startedAt !== "string" ||
    typeof lastSeenAt !== "string"
  ) {
    return undefined;
  }

  try {
    return AdminSession.reconstruct({
      id,
      credentialId: CredentialId.create(credentialId),
      startedAt: Temporal.Instant.from(startedAt),
      lastSeenAt: Temporal.Instant.from(lastSeenAt),
    });
  } catch {
    return undefined;
  }
}
