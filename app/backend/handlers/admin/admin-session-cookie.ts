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
 */
export const ADMIN_SESSION_COOKIE = "admin-session";

const SECONDS_PER_DAY = 86_400;

/** サイト全体に効かせる。下書きの閲覧は管理画面の外 (記事ページ) でも要る。 */
const PATH = "/";

/** Cookie ヘッダーから管理者のセッション識別子を読む。無い・読めないなら undefined。 */
export function readAdminSessionId(cookieHeader: string | null): AdminSessionId | undefined {
  const raw = readCookieValues(cookieHeader, ADMIN_SESSION_COOKIE).at(0);
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
    `${ADMIN_SESSION_COOKIE}=${id.toString()}`,
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
    `${ADMIN_SESSION_COOKIE}=`,
    "Max-Age=0",
    `Path=${PATH}`,
    "HttpOnly",
    "SameSite=Strict",
    ...(options.secure ? ["Secure"] : []),
  ].join("; ");
}
