import {
  AUTH_SESSION_LIFETIME_DAYS,
  AuthSessionId,
  InvalidAuthSessionIdError,
} from "~/backend/domain/auth";
import { readCookieValues } from "~/lib/cookie";

/**
 * ログインしている人のセッション識別子を運ぶ cookie。
 *
 * 読み手のセッション (`session`) とは別の名前にする。あちらは「その日どの記事を
 * 読んだか」を指すだけだが、**これを持っている人はその人として扱われる** (ADR 0039)。
 *
 * ## `__Host-` を付ける
 *
 * 既定では `staging.yantene.net` が `Domain=yantene.net` の cookie を置ける。
 * 置かれると production にも送られ、**先に並んだほうが本物のセッションを覆い隠す**
 * (cookie tossing)。`__Host-` 付きの cookie はブラウザが「`Secure` で `Path=/` で
 * `Domain` 無し」でなければ受け取らないので、他のホストからは置けなくなる。
 *
 * `Secure` が要るので development だけ前置を外す。**読むときも同じ名前しか見ない。**
 * 両方受け入れると、前置を付けた意味が無くなる (覆い隠す側の名前が通ってしまう)。
 */
const BARE_NAME = "auth";

/** development 以外で使う名前。 */
const HOST_LOCKED_NAME = `__Host-${BARE_NAME}`;

const SECONDS_PER_DAY = 86_400;

/** `__Host-` の条件でもあり、ログインはサイト全体に効くので `/` で固定。 */
const PATH = "/";

/**
 * その環境で使う cookie の名前。
 *
 * @param secure `Secure` を付ける環境か (development 以外)
 */
export function authSessionCookieName(secure: boolean): string {
  return secure ? HOST_LOCKED_NAME : BARE_NAME;
}

/** Cookie ヘッダーからセッション識別子を読む。無い・読めないなら undefined。 */
export function readAuthSessionId(
  cookieHeader: string | null,
  options: { readonly secure: boolean },
): AuthSessionId | undefined {
  const raw = readCookieValues(cookieHeader, authSessionCookieName(options.secure)).at(0);
  if (raw === undefined) return undefined;

  try {
    return AuthSessionId.create(raw);
  } catch (error) {
    if (error instanceof InvalidAuthSessionIdError) return undefined;
    throw error;
  }
}

/**
 * セッション識別子を預ける Set-Cookie を組み立てる。
 *
 * @param options.secure development 以外では必ず true (secure by default)
 */
export function buildAuthSessionCookie(
  id: AuthSessionId,
  options: { readonly secure: boolean },
): string {
  return [
    `${authSessionCookieName(options.secure)}=${id.toString()}`,
    `Max-Age=${String(AUTH_SESSION_LIFETIME_DAYS * SECONDS_PER_DAY)}`,
    `Path=${PATH}`,
    "HttpOnly",
    /*
     * `Strict` にはしない。**知り合い向けの記事を渡された人は、その URL を他所
     * (チャットやメール) から踏んで来る。** `Strict` だと最初の 1 回だけ
     * ログアウト状態で描かれ、読めるはずのものが読めない。
     */
    "SameSite=Lax",
    ...(options.secure ? ["Secure"] : []),
  ].join("; ");
}

/** セッションを捨てさせる Set-Cookie。ログアウトと、読めない識別子を受け取ったときに出す。 */
export function buildClearedAuthSessionCookie(options: { readonly secure: boolean }): string {
  return [
    `${authSessionCookieName(options.secure)}=`,
    "Max-Age=0",
    `Path=${PATH}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(options.secure ? ["Secure"] : []),
  ].join("; ");
}
