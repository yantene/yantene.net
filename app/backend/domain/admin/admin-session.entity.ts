import type { AdminSessionId } from "./admin-session-id.vo";
import type { CredentialId } from "./credential-id.vo";
import { Temporal } from "@js-temporal/polyfill";

/**
 * 管理者のセッションの寿命 (日)。
 *
 * 読み手のセッション (400 日) よりずっと短くする (ADR 0036)。cookie を盗まれたときに
 * 使える窓がそのまま寿命になるため。使うたびに延ばすので、触り続けている限り切れない。
 */
export const ADMIN_SESSION_LIFETIME_DAYS = 14;

/**
 * 触った記録を書き戻す間隔 (分)。
 *
 * 寿命が 14 日の持ち回りなので、1 時間に 1 度書き直せば十分に延び続ける。
 *
 * **毎回書き戻さないのは、同じ鍵への連続した書き込みになるため。** 画面の操作は
 * どれも「叩く → 読み直す」の対で、サインインも鍵の取り消しも 100 ミリ秒と
 * 置かずに 2 度この記録に触る。置き場によっては秒あたりの書き込みに上限があり、
 * 弾かれるとその要求ごと落ちて、サインインした直後に画面が壊れる。
 */
export const ADMIN_SESSION_RENEWAL_INTERVAL_MINUTES = 60;

interface AdminSessionFields {
  readonly id: AdminSessionId;
  /**
   * どの passkey で入ったか。
   *
   * 要求のたびにこの鍵がまだ在るかを確かめ、取り消されていればセッションを畳む
   * (AdminAuthService.touchSession)。触るたびに期限が延びるので、畳まなければ
   * 取り消した鍵のセッションが永遠に生き続ける。
   */
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

  /**
   * 触った記録を書き戻すべきか。前回から間が空いていなければ書かない。
   *
   * 書かない回は期限も延びないが、延びるのは書いた時点から 14 日なので、
   * 持ち回りの窓が最大でもこの間隔ぶんしか縮まらない。
   */
  needsRenewal(at: Temporal.Instant): boolean {
    const renewableAt = this.fields.lastSeenAt.add({
      minutes: ADMIN_SESSION_RENEWAL_INTERVAL_MINUTES,
    });
    return Temporal.Instant.compare(at, renewableAt) >= 0;
  }
}
