import type { AdminSessionId } from "./admin-session-id.vo";
import type { CredentialId } from "./credential-id.vo";
import type { Temporal } from "@js-temporal/polyfill";

/**
 * 管理者のセッションの寿命 (日)。
 *
 * 読み手のセッション (400 日) よりずっと短くする (ADR 0036)。cookie を盗まれたときに
 * 使える窓がそのまま寿命になるため。使うたびに延ばすので、触り続けている限り切れない。
 */
export const ADMIN_SESSION_LIFETIME_DAYS = 14;

interface AdminSessionFields {
  readonly id: AdminSessionId;
  /** どの passkey で入ったか。鍵を取り消したときに、その鍵のセッションを畳むために持つ。 */
  readonly credentialId: CredentialId;
  readonly startedAt: Temporal.Instant;
  readonly lastSeenAt: Temporal.Instant;
}

/**
 * ログイン中の管理者ひとりぶんの状態。
 *
 * 持つのは「いつ始まり、いつ最後に触ったか」だけ。ここに何を入れるかは慎重に決めること。
 * 読み手のセッションと違い、**この値を持っている人は記事を書き換えられる**。
 */
export class AdminSession {
  private constructor(private readonly fields: AdminSessionFields) {}

  static start(params: {
    id: AdminSessionId;
    credentialId: CredentialId;
    at: Temporal.Instant;
  }): AdminSession {
    return new AdminSession({
      id: params.id,
      credentialId: params.credentialId,
      startedAt: params.at,
      lastSeenAt: params.at,
    });
  }

  static reconstruct(fields: AdminSessionFields): AdminSession {
    return new AdminSession(fields);
  }

  get id(): AdminSessionId {
    return this.fields.id;
  }

  get credentialId(): CredentialId {
    return this.fields.credentialId;
  }

  get startedAt(): Temporal.Instant {
    return this.fields.startedAt;
  }

  get lastSeenAt(): Temporal.Instant {
    return this.fields.lastSeenAt;
  }

  /** 触ったことを書き加えた新しいセッションを返す (非破壊)。 */
  withSeen(at: Temporal.Instant): AdminSession {
    return new AdminSession({ ...this.fields, lastSeenAt: at });
  }
}
