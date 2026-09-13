import { useSyncExternalStore } from "react";
import { fromBase64Url, toBase64Url } from "~/lib/base64url";

/**
 * ブラウザ側の WebAuthn の儀式 (ADR 0036)。
 *
 * サーバーとは base64url の JSON でやり取りし、ここで `ArrayBuffer` に起こして
 * `navigator.credentials` に渡す。`PublicKeyCredential.parseCreationOptionsFromJSON`
 * は使わない。実装している版が限られており、無い版のために結局この変換を持つことに
 * なるため、経路を 1 本に揃えてある。
 */

/*
 * この端末で passkey を使えるか。**描画の中で直に見ない。**
 *
 * `PublicKeyCredential` はクライアントにしか無いので、描画時に判定すると SSR が
 * 必ず「使えない」を描き、ハイドレーションで食い違う (#156 と同じ壊れ方)。
 * 判定は `useSyncExternalStore` に預けて、ハイドレーションの後に効かせる。
 *
 * 引数に無名関数を渡すと購読し直しになるので、関数はモジュールに置いて固定する
 * (share-menu.tsx と同じ形)。
 */
const unsubscribe = (): void => undefined;
const subscribeToNothing = (): (() => void) => unsubscribe;
const supportedHere = (): boolean => typeof PublicKeyCredential === "function";
/*
 * サーバー側は「使える」に倒す。使える環境のほうが多数で、そちらでは一度も
 * 書き換えが起きない。使えない環境だけが、ハイドレーションの後に差し替わる。
 * 逆に倒すと、ほぼ全員が「使えません」を一瞬見ることになる。
 */
const supportedOnServer = (): boolean => true;

/** この端末で passkey を使えるか。使えない環境では画面から呼びかけない。 */
export function usePasskeySupport(): boolean {
  return useSyncExternalStore(subscribeToNothing, supportedHere, supportedOnServer);
}

/** 利用者が取りやめた (ダイアログを閉じた・触らなかった)。失敗として騒がない。 */
export class PasskeyCancelledError extends Error {
  readonly name = "PasskeyCancelledError";
}

interface RegistrationOptionsJson {
  readonly challenge: string;
  readonly rp: { readonly id: string; readonly name: string };
  readonly user: { readonly id: string; readonly name: string; readonly displayName: string };
  readonly pubKeyCredParams: readonly { readonly type: string; readonly alg: number }[];
  readonly authenticatorSelection: {
    readonly residentKey: string;
    readonly requireResidentKey: boolean;
    readonly userVerification: string;
  };
  readonly excludeCredentials: readonly { readonly type: string; readonly id: string }[];
  readonly attestation: string;
  readonly timeout: number;
}

interface AuthenticationOptionsJson {
  readonly challenge: string;
  readonly rpId: string;
  readonly userVerification: string;
  readonly timeout: number;
}

/** サーバーへ送る登録の応答。 */
export interface RegistrationResponseJson {
  readonly id: string;
  readonly response: {
    readonly clientDataJSON: string;
    readonly attestationObject: string;
  };
}

/** サーバーへ送る認証の応答。 */
export interface AuthenticationResponseJson {
  readonly id: string;
  readonly response: {
    readonly clientDataJSON: string;
    readonly authenticatorData: string;
    readonly signature: string;
  };
}

/** 新しい passkey を作る。 */
export async function createPasskey(
  options: RegistrationOptionsJson,
): Promise<RegistrationResponseJson> {
  const credential = await request(() =>
    navigator.credentials.create({
      publicKey: {
        challenge: bufferOf(options.challenge),
        rp: options.rp,
        user: {
          id: bufferOf(options.user.id),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams.map((param) => ({
          type: param.type as "public-key",
          alg: param.alg,
        })),
        authenticatorSelection: {
          residentKey: options.authenticatorSelection.residentKey as ResidentKeyRequirement,
          requireResidentKey: options.authenticatorSelection.requireResidentKey,
          userVerification: options.authenticatorSelection
            .userVerification as UserVerificationRequirement,
        },
        excludeCredentials: options.excludeCredentials.map((entry) => ({
          type: entry.type as "public-key",
          id: bufferOf(entry.id),
        })),
        attestation: options.attestation as AttestationConveyancePreference,
        timeout: options.timeout,
      },
    }),
  );

  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    response: {
      clientDataJSON: base64UrlOf(response.clientDataJSON),
      attestationObject: base64UrlOf(response.attestationObject),
    },
  };
}

/** 登録済みの passkey で署名する。 */
export async function signWithPasskey(
  options: AuthenticationOptionsJson,
): Promise<AuthenticationResponseJson> {
  const credential = await request(() =>
    navigator.credentials.get({
      publicKey: {
        challenge: bufferOf(options.challenge),
        rpId: options.rpId,
        userVerification: options.userVerification as UserVerificationRequirement,
        timeout: options.timeout,
        // allowCredentials は渡さない。サーバーが登録済みの id を配らないため
        // (ADR 0036)。端末が自分で持っている鍵から選ぶ。
      },
    }),
  );

  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    response: {
      clientDataJSON: base64UrlOf(response.clientDataJSON),
      authenticatorData: base64UrlOf(response.authenticatorData),
      signature: base64UrlOf(response.signature),
    },
  };
}

/**
 * 儀式を呼び、取りやめを別のエラーに畳む。
 *
 * ブラウザは「利用者が閉じた」も「時間切れ」も `NotAllowedError` で返す。どちらも
 * 落ち度ではないので、画面では失敗として赤く出さない。
 */
async function request(work: () => Promise<Credential | null>): Promise<PublicKeyCredential> {
  let credential: Credential | null;
  try {
    credential = await work();
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new PasskeyCancelledError("the passkey prompt was dismissed");
    }
    throw error;
  }
  if (credential === null) throw new PasskeyCancelledError("no credential was returned");
  return credential as PublicKeyCredential;
}

function bufferOf(base64Url: string): ArrayBuffer {
  return fromBase64Url(base64Url).buffer;
}

function base64UrlOf(buffer: ArrayBuffer): string {
  return toBase64Url(new Uint8Array(buffer));
}
