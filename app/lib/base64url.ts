/**
 * base64url (RFC 4648 §5) の相互変換。
 *
 * WebAuthn はバイト列を JSON で運ぶときに base64url を使う。ブラウザとサーバーの
 * 両方で同じ変換が要るので `app/lib` に置く。
 *
 * 詰め物 (`=`) は付けない。付けないのが WebAuthn の JSON 表現の慣習で、読むときは
 * 付いていても受け取る。
 */

const BYTES_PER_CHUNK = 0x8000;

/** バイト列を base64url にする。 */
export function toBase64Url(bytes: Uint8Array): string {
  // String.fromCodePoint は引数を全部スタックに積む。長いバイト列でスタックを
  // 溢れさせないよう小分けにする (公開鍵は数百バイトだが、原文の取り回しで
  // 大きいものを渡されても壊れないようにしておく)。
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BYTES_PER_CHUNK) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + BYTES_PER_CHUNK));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** base64url として読めない文字列を渡された。 */
export class InvalidBase64UrlError extends Error {
  readonly name = "InvalidBase64UrlError";
}

const base64UrlPattern = /^[\w-]*={0,2}$/;

/**
 * base64url をバイト列に戻す。読めなければ {@link InvalidBase64UrlError}。
 *
 * 受け取る値は外から来る (ブラウザが送る JSON) ので、黙って空のバイト列に倒さない。
 * 空に倒すと、壊れた入力が「長さ 0 の正しい入力」として検証の先へ進む。
 */
export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!base64UrlPattern.test(value)) {
    throw new InvalidBase64UrlError(`not base64url: ${JSON.stringify(value.slice(0, 64))}`);
  }
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new InvalidBase64UrlError("base64url has a bad length");
  }
  return Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0);
}
