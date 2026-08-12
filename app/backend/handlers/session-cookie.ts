import {
  InvalidSessionIdError,
  SESSION_LIFETIME_DAYS,
  SessionId,
} from "~/backend/domain/session";

/**
 * 読み手のセッション識別子を運ぶ cookie。
 *
 * 中身は識別子だけで、意味のある値は何も入れない。セッションの持ち物は KV 側にあり、
 * これはそこを指す鍵にすぎない。読み手に見えても、他人のものを当てられなければ困らない。
 */
export const SESSION_COOKIE = "session";

const SECONDS_PER_DAY = 86_400;

/**
 * この cookie を送ってほしい範囲。
 *
 * セッションはノートに限った話ではないので、サイト全体に効かせる。
 */
const PATH = "/";

/** Cookie ヘッダーからセッション識別子を読む。無い・読めないなら undefined。 */
export function readSessionId(
  cookieHeader: string | null,
): SessionId | undefined {
  const raw = pickCookie(cookieHeader, SESSION_COOKIE);
  if (raw === undefined) return undefined;

  try {
    return SessionId.create(raw);
  } catch (error) {
    // 読み手が書き換えられる値なので、形が違えば「持っていない」に倒して発行し直す。
    if (error instanceof InvalidSessionIdError) return undefined;
    throw error;
  }
}

/**
 * セッション識別子を預ける Set-Cookie を組み立てる。
 *
 * 応答のたびに出して期限を引き直す。読み続けている人のセッションが、ある日
 * 突然切れて別人になることがないようにするため。
 *
 * @param options.secure development 以外では必ず true (secure by default)
 */
export function buildSessionCookie(
  id: SessionId,
  options: { readonly secure: boolean },
): string {
  return [
    `${SESSION_COOKIE}=${id.toString()}`,
    `Max-Age=${String(SESSION_LIFETIME_DAYS * SECONDS_PER_DAY)}`,
    `Path=${PATH}`,
    // 読み手の JavaScript に鍵を触らせない。盗まれると他人になりすませる。
    "HttpOnly",
    // 他所からの遷移でも送ってほしい (リンクを踏んで来た人も同じ人として扱う)。
    "SameSite=Lax",
    ...(options.secure ? ["Secure"] : []),
  ].join("; ");
}

/** Cookie ヘッダーから名前の一致する値を取り出す。無ければ undefined。 */
function pickCookie(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  const prefix = `${name}=`;
  const entry = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return entry?.slice(prefix.length);
}
