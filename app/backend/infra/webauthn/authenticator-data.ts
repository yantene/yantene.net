import { sliceCoseKey } from "./cose-key";

/**
 * authenticator data (WebAuthn §6.1) を読む。
 *
 * ```
 * rpIdHash (32) | flags (1) | signCount (4)
 *   [ AAGUID (16) | credentialIdLength (2) | credentialId | COSE 公開鍵 ]   ← AT が立つとき
 *   [ 拡張 (CBOR の map) ]                                                  ← ED が立つとき
 * ```
 *
 * 公開鍵には長さの前置きが無いので、CBOR を読んで切れ目を決める (cose-key の
 * `sliceCoseKey`)。切れ目を決めずに「残り全部」を鍵とすると、拡張が付いている応答で
 * 鍵が読めなくなる。
 */

export class AuthenticatorDataError extends Error {
  readonly name = "AuthenticatorDataError";
}

/** flags (WebAuthn §6.1)。 */
export const AUTHENTICATOR_FLAGS = {
  userPresent: 0x01,
  userVerified: 0x04,
  backupEligible: 0x08,
  backupState: 0x10,
  attestedCredentialData: 0x40,
  extensionData: 0x80,
} as const;

export interface AuthenticatorFlags {
  /** 利用者がその場にいた (何かに触れた)。 */
  readonly userPresent: boolean;
  /** 利用者を確かめた (生体・PIN)。 */
  readonly userVerified: boolean;
  /** 鍵が同期されうる (パスキー)。 */
  readonly backupEligible: boolean;
  /** 鍵がいま同期されている。 */
  readonly backupState: boolean;
}

export interface AttestedCredential {
  readonly aaguid: Uint8Array;
  readonly credentialId: Uint8Array;
  /** COSE_Key の CBOR。そのまま保存して、検証のたびに取り込む。 */
  readonly coseKey: Uint8Array;
}

export interface ParsedAuthenticatorData {
  readonly rpIdHash: Uint8Array;
  readonly flags: AuthenticatorFlags;
  readonly signCount: number;
  /** AT が立っているときだけ。登録の応答には必ず付く。 */
  readonly attestedCredential: AttestedCredential | undefined;
}

const RP_ID_HASH_BYTES = 32;
const FLAGS_OFFSET = 32;
const SIGN_COUNT_OFFSET = 33;
const HEADER_BYTES = 37;
const AAGUID_BYTES = 16;
const CREDENTIAL_ID_LENGTH_BYTES = 2;

/**
 * 認証器が返す credential ID の長さの上限。
 *
 * WebAuthn は 1023 バイトまでと定めている (§6.5.1)。長さの欄は 2 バイトなので
 * 65535 まで書けてしまい、書かれたぶんだけ読もうとすると入力の終わりに当たる。
 * 仕様の上限で先に弾く。
 */
const MAX_CREDENTIAL_ID_BYTES = 1023;

export function parseAuthenticatorData(bytes: Uint8Array): ParsedAuthenticatorData {
  if (bytes.length < HEADER_BYTES) {
    throw new AuthenticatorDataError(
      `authenticator data is ${String(bytes.length)} bytes, shorter than the ${String(HEADER_BYTES)}-byte header`,
    );
  }

  const rawFlags = bytes[FLAGS_OFFSET];
  const flags: AuthenticatorFlags = {
    userPresent: (rawFlags & AUTHENTICATOR_FLAGS.userPresent) !== 0,
    userVerified: (rawFlags & AUTHENTICATOR_FLAGS.userVerified) !== 0,
    backupEligible: (rawFlags & AUTHENTICATOR_FLAGS.backupEligible) !== 0,
    backupState: (rawFlags & AUTHENTICATOR_FLAGS.backupState) !== 0,
  };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signCount = view.getUint32(SIGN_COUNT_OFFSET, false);

  const hasAttested = (rawFlags & AUTHENTICATOR_FLAGS.attestedCredentialData) !== 0;
  const attestedCredential = hasAttested ? readAttestedCredential(bytes) : undefined;

  return {
    rpIdHash: bytes.slice(0, RP_ID_HASH_BYTES),
    flags,
    signCount,
    attestedCredential,
  };
}

function readAttestedCredential(bytes: Uint8Array): AttestedCredential {
  const lengthOffset = HEADER_BYTES + AAGUID_BYTES;
  const idOffset = lengthOffset + CREDENTIAL_ID_LENGTH_BYTES;
  if (bytes.length < idOffset) {
    throw new AuthenticatorDataError("attested credential data is truncated");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const credentialIdLength = view.getUint16(lengthOffset, false);
  if (credentialIdLength === 0 || credentialIdLength > MAX_CREDENTIAL_ID_BYTES) {
    throw new AuthenticatorDataError(
      `credential id length ${String(credentialIdLength)} is outside 1..${String(MAX_CREDENTIAL_ID_BYTES)}`,
    );
  }

  const keyOffset = idOffset + credentialIdLength;
  if (bytes.length <= keyOffset) {
    throw new AuthenticatorDataError("attested credential data has no public key");
  }

  return {
    aaguid: bytes.slice(HEADER_BYTES, lengthOffset),
    credentialId: bytes.slice(idOffset, keyOffset),
    // 鍵の切れ目は CBOR が決める。後ろに拡張が続いていても巻き込まない。
    coseKey: sliceCoseKey(bytes, keyOffset),
  };
}
