import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { MiddlewareHandler } from "hono";
import type { ISessionStore } from "~/backend/domain/shared";
import { KvSessionStore } from "~/backend/infra/kv/session.store";
import { unauthorizedResponse } from "~/lib/problem-details";

export const SESSION_COOKIE_NAME = "session_id";

export type HonoApp = {
  Bindings: Env;
  Variables: { userId: string };
};

type OnUnauthorized = "401" | "redirect";

/**
 * 認証ミドルウェアのファクトリ。`onUnauthorized` で未認証時の挙動を切り替える。
 *
 * - "401": Problem Details 形式の 401 を返す (API ルート向け)
 * - "redirect": `/login` へ 303 リダイレクト (ページ向け)
 */
export function createSessionMiddleware(
  options: {
    getSessionStore?: (kv: KVNamespace) => ISessionStore;
    onUnauthorized?: OnUnauthorized;
  } = {},
): MiddlewareHandler<HonoApp> {
  const {
    getSessionStore = (kv: KVNamespace): ISessionStore =>
      new KvSessionStore(kv),
    onUnauthorized = "401",
  } = options;

  return createMiddleware<HonoApp>(async (c, next) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);

    const reject = (): Response =>
      onUnauthorized === "redirect"
        ? c.redirect("/login", 303)
        : unauthorizedResponse();

    if (sessionId === undefined) return reject();

    const store = getSessionStore(c.env.KV);
    const session = await store.get(sessionId);
    if (session === undefined) return reject();

    c.set("userId", session.userId);
    await next();
  });
}

/** API 用: 未認証時に 401 を返す */
export const requireSession = createSessionMiddleware({
  onUnauthorized: "401",
});

/**
 * ページ用: 未認証時に /login へリダイレクト。
 *
 * 現状ログインは休眠中で利用箇所が無い。認証必須ページ (将来の有料記事等) を
 * 追加するときに、`getApp()` で React Router へ委譲する前段に挟んで使う。
 */
export const requireSessionOrRedirect = createSessionMiddleware({
  onUnauthorized: "redirect",
});
