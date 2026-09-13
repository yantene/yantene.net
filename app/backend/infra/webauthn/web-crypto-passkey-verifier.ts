import { parseAuthenticatorData, type ParsedAuthenticatorData } from "./authenticator-data";
import { decodeCborExact } from "./cbor";
import { verifyClientData, type CeremonyType } from "./client-data";
import { importCoseKey } from "./cose-key";
import { derToRawEcdsaSignature } from "./ecdsa-signature";
import type {
  AdminCredential,
  AuthenticationResponse,
  CeremonyExpectation,
  IPasskeyVerifier,
  RegistrationResponse,
  VerifiedAuthentication,
  VerifiedRegistration,
} from "~/backend/domain/admin";
import { CredentialId, PasskeyVerificationError } from "~/backend/domain/admin";
import { fromBase64Url, toBase64Url } from "~/lib/base64url";

/**
 * Web Crypto で WebAuthn の応答を検証する {@link IPasskeyVerifier} 実装 (ADR 0036)。
 *
 * ライブラリを入れずに自前で持つ。重さのほとんどを占めるアテステーション証明書の検証は
 * もともと行わないため (登録するのは自分の端末だけ)。
 *
 * **確かめること。落ちたら送出する (真偽値を返さない)。**
 *
 * | | 登録 | 認証 |
 * | --- | --- | --- |
 * | 儀式の種類 (`webauthn.create` / `.get`) | ✓ | ✓ |
 * | チャレンジが発行したものと同じ | ✓ | ✓ |
 * | origin が自分のサイト | ✓ | ✓ |
 * | 別生成元の frame でない | ✓ | ✓ |
 * | RP ID のハッシュが合う | ✓ | ✓ |
 * | 利用者がその場にいた (UP) | ✓ | ✓ |
 * | 利用者を確かめた (UV) | ✓ | ✓ |
 * | 公開鍵が取り込める | ✓ | — |
 * | 署名が公開鍵で検証できる | — | ✓ |
 *
 * 登録の応答に署名の検証が無いのは、`none` のアテステーションには署名が無いため。
 * 登録が自分のものであることは、チャレンジと origin、そして**登録の入口を守ること**
 * (ADR 0036) で担保する。
 */
export class WebCryptoPasskeyVerifier implements IPasskeyVerifier {
  async verifyRegistration(
    response: RegistrationResponse,
    expected: CeremonyExpectation,
  ): Promise<VerifiedRegistration> {
    const authenticatorData = await this.verifyCeremony(
      "webauthn.create",
      response.clientDataJSON,
      readAuthenticatorDataFromAttestation(response.attestationObject),
      expected,
    );

    const attested = authenticatorData.attestedCredential;
    if (attested === undefined) {
      throw new PasskeyVerificationError("registration response has no attested credential data");
    }

    // credential id は応答の 2 か所 (JSON と authenticator data) にある。食い違う応答を
    // 受け入れると、保存する id と署名が効く id が別々になりうる。
    const credentialId = toBase64Url(attested.credentialId);
    if (response.id !== credentialId) {
      throw new PasskeyVerificationError(
        "credential id in the response does not match the one signed",
      );
    }

    // 鍵として取り込めることをここで確かめる。取り込めない鍵を保存すると、
    // 登録は通ったのに二度とログインできない資格情報が残る。
    const { algorithm } = await wrapAsync(() => importCoseKey(attested.coseKey));

    return {
      credentialId: CredentialId.create(credentialId),
      publicKey: toBase64Url(attested.coseKey),
      algorithm,
      signCount: authenticatorData.signCount,
      backedUp: authenticatorData.flags.backupState,
    };
  }

  async verifyAuthentication(
    response: AuthenticationResponse,
    credential: AdminCredential,
    expected: CeremonyExpectation,
  ): Promise<VerifiedAuthentication> {
    if (response.id !== credential.id.toString()) {
      throw new PasskeyVerificationError("response is for a different credential");
    }

    const authenticatorDataBytes = decode(response.authenticatorData, "authenticatorData");
    const authenticatorData = await this.verifyCeremony(
      "webauthn.get",
      response.clientDataJSON,
      authenticatorDataBytes,
      expected,
    );

    await verifySignature({
      publicKey: credential.publicKey,
      algorithm: credential.algorithm,
      authenticatorData: authenticatorDataBytes,
      clientDataJson: decode(response.clientDataJSON, "clientDataJSON"),
      signature: decode(response.signature, "signature"),
    });

    return {
      credentialId: credential.id,
      signCount: authenticatorData.signCount,
      backedUp: authenticatorData.flags.backupState,
    };
  }

  /** 登録と認証で共通の確かめ。clientDataJSON と authenticator data を見る。 */
  private async verifyCeremony(
    type: CeremonyType,
    clientDataJson: string,
    authenticatorDataBytes: Uint8Array,
    expected: CeremonyExpectation,
  ): Promise<ParsedAuthenticatorData> {
    wrap(() =>
      verifyClientData(decode(clientDataJson, "clientDataJSON"), {
        type,
        challenge: expected.challenge,
        origin: expected.origin,
      }),
    );

    const authenticatorData = wrap(() => parseAuthenticatorData(authenticatorDataBytes));

    const expectedRpIdHash = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected.rpId)),
    );
    if (!equalBytes(authenticatorData.rpIdHash, expectedRpIdHash)) {
      throw new PasskeyVerificationError(
        `authenticator signed for a different RP than ${expected.rpId}`,
      );
    }

    // UP が無い = 誰も触っていない。UV が無い = 端末が持ち主を確かめていない。
    // 管理者の認証なので両方を求める (登録を求めるときも userVerification: "required")。
    if (!authenticatorData.flags.userPresent) {
      throw new PasskeyVerificationError("authenticator did not report user presence");
    }
    if (!authenticatorData.flags.userVerified) {
      throw new PasskeyVerificationError("authenticator did not verify the user");
    }

    return authenticatorData;
  }
}

async function verifySignature(params: {
  publicKey: string;
  algorithm: "ES256" | "RS256";
  // `crypto.subtle` は ArrayBuffer に載ったバイト列しか受けないので、型で断っておく。
  // ここに来る値はすべて base64url から起こしたばかりのもの。
  readonly authenticatorData: Uint8Array<ArrayBuffer>;
  readonly clientDataJson: Uint8Array<ArrayBuffer>;
  readonly signature: Uint8Array<ArrayBuffer>;
}): Promise<void> {
  const { key } = await wrapAsync(() =>
    importCoseKey(decode(params.publicKey, "stored public key")),
  );

  // 署名の対象は authenticatorData || SHA-256(clientDataJSON) (WebAuthn §6.3.3 step 20)。
  const clientDataHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", params.clientDataJson),
  );
  const signed = new Uint8Array(params.authenticatorData.length + clientDataHash.length);
  signed.set(params.authenticatorData, 0);
  signed.set(clientDataHash, params.authenticatorData.length);

  // ES256 の署名は DER で運ばれる。RS256 は包まれていない (WebAuthn §6.5.6)。
  const isEcdsa = params.algorithm === "ES256";
  const signature = isEcdsa
    ? wrap(() => derToRawEcdsaSignature(params.signature))
    : params.signature;
  const algorithm: EcdsaParams | AlgorithmIdentifier = isEcdsa
    ? { name: "ECDSA", hash: "SHA-256" }
    : "RSASSA-PKCS1-v1_5";

  if (!(await crypto.subtle.verify(algorithm, key, signature, signed))) {
    throw new PasskeyVerificationError("signature does not match the registered public key");
  }
}

/** attestation object から authenticator data を取り出す。 */
function readAuthenticatorDataFromAttestation(attestationObject: string): Uint8Array {
  const decoded = wrap(() => decodeCborExact(decode(attestationObject, "attestationObject")));
  if (!(decoded instanceof Map)) {
    throw new PasskeyVerificationError("attestation object is not a map");
  }
  const authData = decoded.get("authData");
  if (!(authData instanceof Uint8Array)) {
    throw new PasskeyVerificationError("attestation object has no authData");
  }
  // fmt と attStmt は読まない。アテステーションを見ない判断 (ADR 0036) の帰結で、
  // 見ないものを取り出しても使い道が無い。
  return authData;
}

function decode(value: string, what: string): Uint8Array<ArrayBuffer> {
  try {
    return fromBase64Url(value);
  } catch {
    throw new PasskeyVerificationError(`${what} is not base64url`);
  }
}

/**
 * 下位の解析エラーをドメインのエラーに畳む。
 *
 * どの段で落ちたかは記録に残すが、呼ぶ側に返るのは 1 種類にする。段ごとに違う型を
 * 返すと、応答の出し分けに使いたくなり、外から内部の状態を読み取れるようになる。
 */
function wrap<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    throw asVerificationError(error);
  }
}

/**
 * 非同期の版。
 *
 * `wrap` に async の仕事を渡しても捕まらない。返るのは Promise で、拒否は
 * try/catch の外で起きるため。**実際に取りこぼしていた** (公開鍵を取り込めない
 * ときに CoseKeyError がそのまま外へ出ていた)。
 */
async function wrapAsync<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw asVerificationError(error);
  }
}

function asVerificationError(error: unknown): PasskeyVerificationError {
  if (error instanceof PasskeyVerificationError) return error;
  return new PasskeyVerificationError(String(error));
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  return left.every((byte, index) => byte === right[index]);
}
