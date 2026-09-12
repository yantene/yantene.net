import { Temporal } from "@js-temporal/polyfill";
import { readAdminSessionId } from "./admin-session-cookie";
import { resolveAdminAuthService } from "./resolve-admin-auth";
import type { AdminSession } from "~/backend/domain/admin";

/**
 * この要求がログイン中の管理者のものかを見る。
 *
 * cookie の識別子を KV に引き当て、生きていれば期限を引き直して返す。ログインして
 * いなければ undefined。**ここが「管理者かどうか」の唯一の判定**で、下書きの閲覧
 * (#466) も Web からの編集 (#467) もこれを通る。
 *
 * 時刻はここで読む。モジュールの評価時に読むと Workers では 1970 年になる
 * (architecture.md)。
 */
export async function currentAdmin(env: Env, request: Request): Promise<AdminSession | undefined> {
  const id = readAdminSessionId(request.headers.get("Cookie"));
  if (id === undefined) return undefined;

  return resolveAdminAuthService(env).touchSession(id, Temporal.Now.instant());
}

/**
 * 管理者が見ている応答に付けるヘッダー。
 *
 * `Vary: Cookie` だけでは経路のどこかに載る危険が残る。載った先で剥がす手立ては
 * 無いので、載せない (ADR 0036)。
 */
export const ADMIN_CACHE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};
