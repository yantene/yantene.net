import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { KvSessionStore } from "~/backend/infra/kv/session.store";
import { SESSION_COOKIE_NAME } from "~/backend/middleware/auth";

/**
 * ログアウトは認証 strategy 共通の処理 (session を切るだけ)。
 * POST /auth/logout で session 破棄 + cookie 削除 → /login へ。
 */
export function createLogoutRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.post("/auth/logout", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (sessionId !== undefined) {
      const store = new KvSessionStore(c.env.KV);
      await store.delete(sessionId);
    }
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
    return c.redirect("/login", 303);
  });

  return router;
}
