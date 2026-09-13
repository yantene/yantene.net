import type { SignInRequestId, SignInToken } from "~/backend/domain/auth";
import {
  SIGN_IN_TOKEN_LIFETIME_MINUTES,
  SignInRequestId as SignInRequestIdVo,
  SignInToken as SignInTokenVo,
} from "~/backend/domain/auth";
import { readCookieValues } from "~/lib/cookie";

const SECONDS_PER_MINUTE = 60;

/** ログインの途中でだけ持つ cookie の寿命。リンクの寿命と揃える。 */
const MAX_AGE_SECONDS = SIGN_IN_TOKEN_LIFETIME_MINUTES * SECONDS_PER_MINUTE;

/**
 * リンクを頼んだブラウザを覚えておく cookie。
 *
 * 同じブラウザから踏まれたときに確認の 1 枚を飛ばすためだけのもの (ADR 0039)。
 * これが無くても・食い違っていても、確認を経由すれば入れる。
 */
const REQUEST_BARE_NAME = "sign-in-request";

/**
 * 踏まれたリンクのトークンを、確認の画面まで運ぶ cookie。
 *
 * **URL には残さない。** 確認の画面を `/sign-in/callback?token=...` のまま描くと、
 * トークンが閲覧の計測 (ADR 0021) の送り先と履歴に載る。**載った時点でそのリンクは
 * 秘密でなくなる。** 受け口で cookie に移し替え、素の URL へ送り直す。
 */
const TOKEN_BARE_NAME = "sign-in-token";

/**
 * `__Host-` を付ける理由は auth-session-cookie.ts と同じ。
 *
 * こちらには「他所のホストからトークンを置かせない」意味もある。置けると、攻撃者が
 * 自分のリンクを他人のブラウザに仕込んで**攻撃者としてログインさせられる**。
 */
function cookieName(bare: string, secure: boolean): string {
  return secure ? `__Host-${bare}` : bare;
}

function build(name: string, value: string, options: { readonly secure: boolean }): string {
  return [
    `${name}=${value}`,
    `Max-Age=${String(MAX_AGE_SECONDS)}`,
    // `__Host-` の条件。分けたくても分けられない。
    "Path=/",
    "HttpOnly",
    // メールの本文から踏んで来る = 他所からの遷移なので `Strict` にはできない。
    "SameSite=Lax",
    ...(options.secure ? ["Secure"] : []),
  ].join("; ");
}

function buildCleared(name: string, options: { readonly secure: boolean }): string {
  return [
    `${name}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    ...(options.secure ? ["Secure"] : []),
  ].join("; ");
}

export function buildSignInRequestCookie(
  id: SignInRequestId,
  options: { readonly secure: boolean },
): string {
  return build(cookieName(REQUEST_BARE_NAME, options.secure), id.toString(), options);
}

export function readSignInRequestId(
  cookieHeader: string | null,
  options: { readonly secure: boolean },
): SignInRequestId | undefined {
  const raw = readCookieValues(cookieHeader, cookieName(REQUEST_BARE_NAME, options.secure)).at(0);
  return raw === undefined ? undefined : SignInRequestIdVo.parse(raw);
}

export function buildClearedSignInRequestCookie(options: { readonly secure: boolean }): string {
  return buildCleared(cookieName(REQUEST_BARE_NAME, options.secure), options);
}

export function buildSignInTokenCookie(
  token: SignInToken,
  options: { readonly secure: boolean },
): string {
  return build(cookieName(TOKEN_BARE_NAME, options.secure), token.toString(), options);
}

export function readSignInToken(
  cookieHeader: string | null,
  options: { readonly secure: boolean },
): SignInToken | undefined {
  const raw = readCookieValues(cookieHeader, cookieName(TOKEN_BARE_NAME, options.secure)).at(0);
  return raw === undefined ? undefined : SignInTokenVo.parse(raw);
}

export function buildClearedSignInTokenCookie(options: { readonly secure: boolean }): string {
  return buildCleared(cookieName(TOKEN_BARE_NAME, options.secure), options);
}

/** 確認の画面が「踏まれたリンクを持っているか」を見るための名前。 */
export function signInTokenCookieName(secure: boolean): string {
  return cookieName(TOKEN_BARE_NAME, secure);
}
