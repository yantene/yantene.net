import { Temporal } from "@js-temporal/polyfill";
import type { AuthSessionId } from "~/backend/domain/auth";
import { AuthSession, EmailAddress } from "~/backend/domain/auth";

/** KV に置く形。JSON にできる値だけで持つ。 */
export interface AuthSessionRecord {
  readonly email: string;
  readonly startedAt: string;
  readonly lastSeenAt: string;
}

/**
 * ログインのセッションを引くキー。
 *
 * 読み手のセッション (`session:`) と同じ名前空間に置くので、接頭辞で分ける。
 * **識別子だけで引けてしまわないようにする**のが目的で、読み手の識別子を
 * ログイン済みのものとして差し出せない。
 */
export function authSessionKey(id: AuthSessionId): string {
  return `auth-session:${id.toString()}`;
}

export function authSessionToRecord(session: AuthSession): AuthSessionRecord {
  return {
    email: session.email.toString(),
    startedAt: session.startedAt.toString(),
    lastSeenAt: session.lastSeenAt.toString(),
  };
}

/**
 * KV から読んだ値をセッションに戻す。読めない形なら undefined。
 *
 * **読み手のセッションと違い、読めないものは起こし直さない。** あちらは記録が壊れても
 * 閲覧の数え方が狂うだけだが、こちらは身元そのもの。読めなければ「ログインしていない」
 * に倒し、もう一度リンクを送ってもらう。
 */
export function recordToAuthSession(id: AuthSessionId, value: unknown): AuthSession | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  const { email, startedAt, lastSeenAt } = value as Record<string, unknown>;
  if (
    typeof email !== "string" ||
    typeof startedAt !== "string" ||
    typeof lastSeenAt !== "string"
  ) {
    return undefined;
  }

  const address = EmailAddress.parse(email);
  if (address === undefined) return undefined;

  try {
    return AuthSession.reconstruct({
      id,
      email: address,
      startedAt: Temporal.Instant.from(startedAt),
      lastSeenAt: Temporal.Instant.from(lastSeenAt),
    });
  } catch {
    return undefined;
  }
}
