import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { resolveMailer } from "./resolve-mailer";
import type { IMailer } from "~/backend/domain/auth";
import { Email, InvalidEmailError } from "~/backend/domain/user";
import {
  D1UserCommandRepository,
  D1UserQueryRepository,
} from "~/backend/infra/d1/repositories";
import { KvMagicLinkTokenStore } from "~/backend/infra/kv/magic-link-token.store";
import { KvSessionStore } from "~/backend/infra/kv/session.store";
import { SESSION_COOKIE_NAME } from "~/backend/middleware/auth";
import { AuthService } from "~/backend/services/auth.service";
import { badRequestResponse } from "~/lib/problem-details";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 日

/**
 * FormData から文字列フィールドを取り出す。
 * 未送信 (null) やファイルアップロード (File) は値として扱わず undefined を返す。
 * 文字列内容のバリデーション (trim・空文字・形式) は呼び出し側の VO に委ねる。
 */
function readStringField(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

function buildVerifyUrl(reqUrl: string, token: string): string {
  const url = new URL(reqUrl);
  url.pathname = "/auth/magic-link/callback";
  url.search = `?token=${encodeURIComponent(token)}`;
  return url.href;
}

/**
 * Composition Root: infra の具象を生成して AuthService に注入する。
 * mailer は遅延注入 (`() => IMailer`) にしておき、メール送信しない経路 (callback) では
 * 解決を走らせない。これにより resolveMailer の本番 fail-loud が不要に発火しない。
 */
function createAuthService(env: Env, getMailer: () => IMailer): AuthService {
  return new AuthService(
    new KvMagicLinkTokenStore(env.KV),
    getMailer,
    new KvSessionStore(env.KV),
    new D1UserQueryRepository(env.D1),
    new D1UserCommandRepository(env.D1),
  );
}

export function createMagicLinkRouter(
  deps: { resolveMailer?: (env: Env) => IMailer } = {},
): Hono<{ Bindings: Env }> {
  const { resolveMailer: resolveMailerFn = resolveMailer } = deps;
  const router = new Hono<{ Bindings: Env }>();

  // POST /auth/magic-link
  // メアドを受け取り、magic link を発行・送信する。常に同じ画面に遷移し、
  // メアドの存在有無は外部に漏らさない (enumeration 対策)。
  router.post("/auth/magic-link", async (c) => {
    const form = await c.req.formData();
    const rawEmail = readStringField(form, "email");
    if (rawEmail === undefined) {
      return badRequestResponse("email field is required");
    }

    let email: Email;
    try {
      email = Email.create(rawEmail);
    } catch (error) {
      if (error instanceof InvalidEmailError) {
        return badRequestResponse(error.message);
      }
      throw error;
    }

    const auth = createAuthService(c.env, () => resolveMailerFn(c.env));
    await auth.requestMagicLink(email, (token) =>
      buildVerifyUrl(c.req.url, token),
    );

    return c.redirect("/login/sent", 303);
  });

  // GET /auth/magic-link/callback?token=xxx
  router.get("/auth/magic-link/callback", async (c) => {
    const token = c.req.query("token");
    if (typeof token !== "string" || token.length === 0) {
      return c.redirect("/login?error=missing_token", 303);
    }

    const auth = createAuthService(c.env, () => resolveMailerFn(c.env));
    const result = await auth.verifyMagicLink(token);
    if (result === undefined) {
      return c.redirect("/login?error=invalid_token", 303);
    }

    setCookie(c, SESSION_COOKIE_NAME, result.sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return c.redirect("/", 303);
  });

  return router;
}
