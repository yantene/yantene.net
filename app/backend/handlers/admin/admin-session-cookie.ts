import {
  ADMIN_SESSION_LIFETIME_DAYS,
  AdminSessionId,
  InvalidAdminSessionIdError,
} from "~/backend/domain/admin";
import { readCookieValues } from "~/lib/cookie";

/**
 * 管理者のセッション識別子を運ぶ cookie。
 *
 * 読み手のセッション (`session`) とは別の名前・別の属性にする。あちらは
 * 「その日どの記事を読んだか」を指すだけだが、**これを持っている人は記事を
 * 書き換えられる** (ADR 0036)。
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
const BARE_NAME = "admin-session";

/** development 以外で使う名前。 */
const HOST_LOCKED_NAME = `__Host-${BARE_NAME}`;

const SECONDS_PER_DAY = 86_400;

/** サイト全体に効かせる。下書きの閲覧は管理画面の外 (記事ページ) でも要る。 */
const PATH = "/";

/**
 * その環境で使う cookie の名前。
 *
 * @param secure `Secure` を付ける環境か (development 以外)
 */
export function adminSessionCookieName(secure: boolean): string {
  return secure ? HOST_LOCKED_NAME : BARE_NAME;
}

/** Cookie ヘッダーから管理者のセッション識別子を読む。無い・読めないなら undefined。 */
export function readAdminSessionId(
  cookieHeader: string | null,
  options: { readonly secure: boolean },
): AdminSessionId | undefined {
  const raw = readCookieValues(cookieHeader, adminSessionCookieName(options.secure)).at(0);
  if (raw === undefined) return undefined;

  try {
    return AdminSessionId.create(raw);
  } catch (error) {
    if (error instanceof InvalidAdminSessionIdError) return undefined;
    throw error;
  }
}

/**
 * セッション識別子を預ける Set-Cookie を組み立てる。
 *
 * @param options.secure development 以外では必ず true (secure by default)
 */
export function buildAdminSessionCookie(
  id: AdminSessionId,
  options: { readonly secure: boolean },
): string {
  return [
    `${adminSessionCookieName(options.secure)}=${id.toString()}`,
    `Max-Age=${String(ADMIN_SESSION_LIFETIME_DAYS * SECONDS_PER_DAY)}`,
    `Path=${PATH}`,
    "HttpOnly",
    // 読み手のセッションと違い Strict にする。あちらは「リンクを踏んで来た人も
    // 同じ人として扱う」ために Lax だが、管理画面に外から辿り着く経路は無い。
    "SameSite=Strict",
    ...(options.secure ? ["Secure"] : []),
  ].join("; ");
}

/** セッションを捨てさせる Set-Cookie。ログアウトと、読めない識別子を受け取ったときに出す。 */
export function buildClearedAdminSessionCookie(options: { readonly secure: boolean }): string {
  return [
    `${adminSessionCookieName(options.secure)}=`,
    "Max-Age=0",
    `Path=${PATH}`,
    "HttpOnly",
    "SameSite=Strict",
    ...(options.secure ? ["Secure"] : []),
  ].join("; ");
}
