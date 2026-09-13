import type { SignInToken } from "~/backend/domain/auth";
import { toBase64Url } from "~/lib/base64url";

/**
 * トークンを置き場に入れる形にする (ADR 0039)。
 *
 * **生の値は保存しない。** ここが表と照合の両方で使われるので、同じ変換を 1 箇所に
 * 持たせる。元が 256 bit の乱数なので、合言葉のような伸長は要らない。
 */
export async function hashSignInToken(token: SignInToken): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token.toString()));
  return toBase64Url(new Uint8Array(digest));
}
