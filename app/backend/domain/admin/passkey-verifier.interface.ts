import type { AdminCredential, CredentialAlgorithm } from "./admin-credential.entity";
import type { CredentialId } from "./credential-id.vo";

/**
 * WebAuthn の応答を検証する口。
 *
 * ドメインは「何を確かめるか」だけを知り、CBOR や COSE や Web Crypto の扱いは infra に
 * 置く (`infra/webauthn/`)。テストでは差し替えて、落ちるべき場合の振る舞いを固定する。
 */

/** ブラウザが返す登録の応答 (値はすべて base64url)。 */
export interface RegistrationResponse {
  readonly id: string;
  readonly clientDataJSON: string;
  readonly attestationObject: string;
}

/** ブラウザが返す認証の応答 (値はすべて base64url)。 */
export interface AuthenticationResponse {
  readonly id: string;
  readonly clientDataJSON: string;
  readonly authenticatorData: string;
  readonly signature: string;
}

/** 儀式が行われた場所と、どのチャレンジに対する応答かの期待。 */
export interface CeremonyExpectation {
  /** 受け入れる origin。`https://yantene.net` のようにスキームまで含む。 */
  readonly origin: string;
  /** 署名が効く範囲。ホスト名 (`yantene.net` / `localhost`)。 */
  readonly rpId: string;
  /** 発行したチャレンジ (base64url)。 */
  readonly challenge: string;
}

/** 検証を通った登録の中身。 */
export interface VerifiedRegistration {
  readonly credentialId: CredentialId;
  /** COSE_Key の CBOR を base64url にしたもの。 */
  readonly publicKey: string;
  readonly algorithm: CredentialAlgorithm;
  readonly signCount: number;
  readonly backedUp: boolean;
}

/** 検証を通った認証の中身。 */
export interface VerifiedAuthentication {
  readonly credentialId: CredentialId;
  readonly signCount: number;
  readonly backedUp: boolean;
}

export interface IPasskeyVerifier {
  /**
   * 登録の応答を検証する。落ちたら送出する (真偽値を返さない)。
   *
   * **アテステーションは見ない** (ADR 0036)。確かめるのは、儀式の種類・チャレンジ・
   * origin・RP ID・利用者を確かめたこと・公開鍵が取り込めることまで。
   */
  verifyRegistration(
    response: RegistrationResponse,
    expected: CeremonyExpectation,
  ): Promise<VerifiedRegistration>;

  /**
   * 認証の応答を、登録済みの資格情報と突き合わせて検証する。落ちたら送出する。
   */
  verifyAuthentication(
    response: AuthenticationResponse,
    credential: AdminCredential,
    expected: CeremonyExpectation,
  ): Promise<VerifiedAuthentication>;
}
