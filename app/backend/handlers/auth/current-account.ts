import { Temporal } from "@js-temporal/polyfill";
import type { EmailAddress } from "~/backend/domain/auth";
import { readAuthSessionId } from "./auth-session-cookie";
import { readSignInToken } from "./sign-in-cookies";
import { resolveAdminEmail, resolveSignInService, shouldUseSecureCookie } from "./resolve-sign-in";

/** いま要求を出している人。ログインしていなければ undefined。 */
export interface CurrentAccount {
  readonly email: EmailAddress;
  /** 管理者として扱うか。**セッションではなく `ADMIN_EMAIL` が決める** (ADR 0039)。 */
  readonly admin: boolean;
}

/**
 * この要求が誰のものかを見る。
 *
 * cookie の識別子を KV に引き当て、生きていれば期限を引き直して返す。**cookie が
 * 無ければ置き場を触らない** — 大半の読み手はログインしないので、その全員に KV の
 * 読みを 1 つ足す理由が無い。
 *
 * 時刻はここで読む。モジュールの評価時に読むと Workers では 1970 年になる
 * (architecture.md)。
 */
export async function currentAccount(
  env: Env,
  request: Request,
): Promise<CurrentAccount | undefined> {
  const id = readAuthSessionId(request.headers.get("Cookie"), {
    secure: shouldUseSecureCookie(env),
  });
  if (id === undefined) return undefined;

  const session = await resolveSignInService(env).touchSession(id, Temporal.Now.instant());
  if (session === undefined) return undefined;

  const admin = resolveAdminEmail(env);
  return {
    email: session.email,
    admin: admin !== undefined && admin.equals(session.email),
  };
}

/**
 * ログインしている人に返す応答に付けるヘッダー。
 *
 * `Vary: Cookie` だけでは経路のどこかに載る危険が残る。載った先で剥がす手立ては
 * 無いので、載せない。
 */
export const PRIVATE_CACHE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

/**
 * 踏まれたリンクを確認の画面まで運ぶ cookie を持っているか。
 *
 * **中身が使えるかどうかまでは見ない。** 見るには置き場を引く必要があり、そこで
 * 「使える / 使えない」を分けて描くと、確認の画面が当てずっぽうの試行に答えることに
 * なる。押されたときに 1 度だけ判定する (ADR 0039)。
 */
export function hasPendingSignInToken(env: Env, request: Request): boolean {
  return (
    readSignInToken(request.headers.get("Cookie"), {
      secure: shouldUseSecureCookie(env),
    }) !== undefined
  );
}
