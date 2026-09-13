/**
 * バイト列を base64url (RFC 4648 §5) にする。
 *
 * 詰め物 (`=`) は付けない。URL とメールのリンクに素で載せられる形にするのが目的で、
 * 付けると経路によっては百分率符号化されてしまう。
 */

const BYTES_PER_CHUNK = 0x8000;

export function toBase64Url(bytes: Uint8Array): string {
  /*
   * String.fromCodePoint は引数を全部スタックに積む。長いバイト列でスタックを
   * 溢れさせないよう小分けにする (ここで渡すのは 16 〜 32 バイトだが、次に使う人が
   * 大きいものを渡しても壊れないようにしておく)。
   */
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BYTES_PER_CHUNK) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + BYTES_PER_CHUNK));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** 乱数から base64url の文字列を作る。 */
export function randomBase64Url(bytes: number): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}
