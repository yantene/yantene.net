import type { CredentialId } from "./credential-id.vo";
import type { Temporal } from "@js-temporal/polyfill";

/** 公開鍵の算法。登録を求めるときに申告する 2 つだけ (ADR 0036)。 */
export type CredentialAlgorithm = "ES256" | "RS256";

interface AdminCredentialFields {
  readonly id: CredentialId;
  /** COSE_Key の CBOR を base64url にしたもの。検証のたびに取り込み直す。 */
  readonly publicKey: string;
  readonly algorithm: CredentialAlgorithm;
  /**
   * 認証器が数えている使用回数。
   *
   * **多くの passkey は 0 のまま動かさない。** 同期される鍵は複数の端末に居るので、
   * 回数を進めても意味を持たないため。0 のままなら複製の検知には使えない
   * ので、ここでは「進んでいれば記録する」だけに留める。
   */
  readonly signCount: number;
  /** 人が見分けるための名前。「MacBook の Touch ID」など。 */
  readonly label: string;
  /** 鍵が同期されている (パスキー) か。端末に閉じた鍵と見分けるために持つ。 */
  readonly backedUp: boolean;
  readonly createdAt: Temporal.Instant;
  /** 最後にこの鍵でログインした時刻。一度も使っていなければ undefined。 */
  readonly lastUsedAt: Temporal.Instant | undefined;
}

/**
 * 管理者が登録した passkey 1 本。
 *
 * 識別子は認証器が決めるので、登録の時点で確定している。保存の前後で持ち物が変わらない
 * ため `IPersisted` / `IUnpersisted` では分けない (Session と同じ扱い)。
 */
export class AdminCredential {
  private constructor(private readonly fields: AdminCredentialFields) {}

  /** 登録したての 1 本 (まだ保存していない)。 */
  static register(params: {
    id: CredentialId;
    publicKey: string;
    algorithm: CredentialAlgorithm;
    signCount: number;
    label: string;
    backedUp: boolean;
    at: Temporal.Instant;
  }): AdminCredential {
    return new AdminCredential({
      id: params.id,
      publicKey: params.publicKey,
      algorithm: params.algorithm,
      signCount: params.signCount,
      label: params.label,
      backedUp: params.backedUp,
      createdAt: params.at,
      lastUsedAt: undefined,
    });
  }

  /** 保存済みの 1 本を復元する。 */
  static reconstruct(fields: AdminCredentialFields): AdminCredential {
    return new AdminCredential(fields);
  }

  get id(): CredentialId {
    return this.fields.id;
  }

  get publicKey(): string {
    return this.fields.publicKey;
  }

  get algorithm(): CredentialAlgorithm {
    return this.fields.algorithm;
  }

  get signCount(): number {
    return this.fields.signCount;
  }

  get label(): string {
    return this.fields.label;
  }

  get backedUp(): boolean {
    return this.fields.backedUp;
  }

  get createdAt(): Temporal.Instant {
    return this.fields.createdAt;
  }

  get lastUsedAt(): Temporal.Instant | undefined {
    return this.fields.lastUsedAt;
  }

  /**
   * この鍵で入ったことを書き加えた新しい資格情報を返す (非破壊)。
   *
   * 使用回数は**進んだときだけ**書き換える。0 のまま動かさない認証器が多く、
   * 受け取った値をそのまま入れると進んだ記録を戻してしまう。
   */
  withUse(signCount: number, at: Temporal.Instant): AdminCredential {
    return new AdminCredential({
      ...this.fields,
      signCount: Math.max(this.fields.signCount, signCount),
      lastUsedAt: at,
    });
  }
}
