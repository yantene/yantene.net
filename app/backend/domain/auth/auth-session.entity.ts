import { Temporal } from "@js-temporal/polyfill";
import type { AuthSessionId } from "./auth-session-id.vo";
import type { EmailAddress } from "./email-address.vo";

/**
 * ログインの寿命 (日)。
 *
 * 読み手のセッション (400 日) よりずっと短くする。cookie を盗まれたときに使える窓が
 * そのまま寿命になるため。使うたびに延ばすので、読み続けている限り切れない。
 */
export const AUTH_SESSION_LIFETIME_DAYS = 30;

/**
 * 触った記録を書き戻す間隔 (分)。
 *
 * **毎回書き戻さないのは、同じ鍵への連続した書き込みになるため。** 置き場によっては
 * 秒あたりの書き込みに上限があり、弾かれるとその要求ごと落ちる。1 時間に 1 度書き直せば
 * 30 日の持ち回りは十分に延び続ける。
 */
export const AUTH_SESSION_RENEWAL_INTERVAL_MINUTES = 60;

interface AuthSessionFields {
  readonly id: AuthSessionId;
  /**
   * 誰として入っているか。
   *
   * **役割はここに持たせない。** 管理者かどうかは要求のたびに `ADMIN_EMAIL` と
   * 引き比べる (ADR 0039)。焼き付けると、外した相手が入ったままになる。
   */
  readonly email: EmailAddress;
  readonly startedAt: Temporal.Instant;
  readonly lastSeenAt: Temporal.Instant;
}

/** ログイン中のひとりぶんの状態。 */
export class AuthSession {
  private constructor(private readonly fields: AuthSessionFields) {}

  static start(params: {
    id: AuthSessionId;
    email: EmailAddress;
    at: Temporal.Instant;
  }): AuthSession {
    return new AuthSession({
      id: params.id,
      email: params.email,
      startedAt: params.at,
      lastSeenAt: params.at,
    });
  }

  static reconstruct(fields: AuthSessionFields): AuthSession {
    return new AuthSession(fields);
  }

  get id(): AuthSessionId {
    return this.fields.id;
  }

  get email(): EmailAddress {
    return this.fields.email;
  }

  get startedAt(): Temporal.Instant {
    return this.fields.startedAt;
  }

  get lastSeenAt(): Temporal.Instant {
    return this.fields.lastSeenAt;
  }

  /** 触ったことを書き加えた新しいセッションを返す (非破壊)。 */
  withSeen(at: Temporal.Instant): AuthSession {
    return new AuthSession({ ...this.fields, lastSeenAt: at });
  }

  /**
   * 触った記録を書き戻すべきか。前回から間が空いていなければ書かない。
   *
   * 書かない回は期限も延びないが、延びるのは書いた時点から数えるので、持ち回りの窓が
   * 最大でもこの間隔ぶんしか縮まらない。
   */
  needsRenewal(at: Temporal.Instant): boolean {
    const renewableAt = this.fields.lastSeenAt.add({
      minutes: AUTH_SESSION_RENEWAL_INTERVAL_MINUTES,
    });
    return Temporal.Instant.compare(at, renewableAt) >= 0;
  }
}
