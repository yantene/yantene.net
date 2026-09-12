import { Temporal } from "@js-temporal/polyfill";
import { Hono } from "hono";
import {
  buildAdminSessionCookie,
  buildClearedAdminSessionCookie,
  readAdminSessionId,
} from "./admin-session-cookie";
import { ADMIN_CACHE_HEADERS, currentAdmin } from "./current-admin";
import {
  readRegistrationToken,
  resolveAdminAuthService,
  shouldUseSecureCookie,
} from "./resolve-admin-auth";
import type { Context } from "hono";
import type { AuthenticationResponse, RegistrationResponse } from "~/backend/domain/admin";
import {
  AdminAuthError,
  CredentialAlreadyRegisteredError,
  CredentialId,
  RegistrationClosedError,
  RegistrationNotAllowedError,
} from "~/backend/domain/admin";
import {
  D1AdminCredentialCommandRepository,
  D1AdminCredentialQueryRepository,
} from "~/backend/infra/d1/repositories";
import { ceremonySiteOf } from "~/backend/services/admin-auth.service";
import { httpStatus } from "~/lib/constants/http-status";
import { createProblemResponse, notFoundResponse } from "~/lib/problem-details";

/**
 * 管理者の認証エンドポイント (ADR 0036)。
 *
 * ```
 * POST   /api/v1/admin/registration-options  登録の儀式を始める
 * POST   /api/v1/admin/registration          登録の応答を検証して保存する
 * POST   /api/v1/admin/session-options       ログインの儀式を始める
 * POST   /api/v1/admin/session               ログインの応答を検証してセッションを起こす
 * DELETE /api/v1/admin/session               ログアウト
 * GET    /api/v1/admin/credentials           登録済みの passkey 一覧
 * DELETE /api/v1/admin/credentials/:id       passkey を取り消す
 * ```
 *
 * **失敗の応答は 1 種類にまとめる。** 「その credential は知らない」と「署名が違う」を
 * 区別して返すと、どの credential が登録済みかを外から数えられる。
 */

/** 鍵の名前の長さの上限。人が見分けるためだけの値なので、短く抑える。 */
const MAX_LABEL_LENGTH = 60;

export const createAdminAuthRouter = (): Hono<{ Bindings: Env }> => {
  const app = new Hono<{ Bindings: Env }>();

  app.post("/admin/registration-options", async (c) => {
    return guard(c, async () => {
      const service = resolveAdminAuthService(c.env);
      await service.assertRegistrationAllowed({
        presentedToken: readPresentedRegistrationToken(c),
        registrationToken: readRegistrationToken(c.env),
        session: await currentAdmin(c.env, c.req.raw),
      });

      const options = await service.beginRegistration(ceremonySiteOf(new URL(c.req.url)));
      return Response.json(options, { headers: ADMIN_CACHE_HEADERS });
    });
  });

  app.post("/admin/registration", async (c) => {
    return guard(c, async () => {
      const service = resolveAdminAuthService(c.env);
      await service.assertRegistrationAllowed({
        presentedToken: readPresentedRegistrationToken(c),
        registrationToken: readRegistrationToken(c.env),
        session: await currentAdmin(c.env, c.req.raw),
      });

      const body = await readJson(c.req.raw);
      const credential = await service.completeRegistration({
        response: readRegistrationResponse(body),
        site: ceremonySiteOf(new URL(c.req.url)),
        label: readLabel(body),
        at: Temporal.Now.instant(),
      });

      return Response.json(
        { id: credential.id.toString(), label: credential.label },
        { status: httpStatus.CREATED, headers: ADMIN_CACHE_HEADERS },
      );
    });
  });

  app.post("/admin/session-options", async (c) => {
    return guard(c, async () => {
      const options = await resolveAdminAuthService(c.env).beginAuthentication(
        ceremonySiteOf(new URL(c.req.url)),
      );
      return Response.json(options, { headers: ADMIN_CACHE_HEADERS });
    });
  });

  app.post("/admin/session", async (c) => {
    return guard(c, async () => {
      const session = await resolveAdminAuthService(c.env).completeAuthentication({
        response: readAuthenticationResponse(await readJson(c.req.raw)),
        site: ceremonySiteOf(new URL(c.req.url)),
        at: Temporal.Now.instant(),
      });

      return Response.json(
        { ok: true },
        {
          headers: {
            ...ADMIN_CACHE_HEADERS,
            "Set-Cookie": buildAdminSessionCookie(session.id, {
              secure: shouldUseSecureCookie(c.env),
            }),
          },
        },
      );
    });
  });

  app.delete("/admin/session", async (c) => {
    const id = readAdminSessionId(c.req.raw.headers.get("Cookie"));
    if (id !== undefined) await resolveAdminAuthService(c.env).logout(id);

    // cookie は識別子の有無によらず捨てさせる。読めない値が残り続けないようにする。
    return Response.json(
      { ok: true },
      {
        headers: {
          ...ADMIN_CACHE_HEADERS,
          "Set-Cookie": buildClearedAdminSessionCookie({
            secure: shouldUseSecureCookie(c.env),
          }),
        },
      },
    );
  });

  app.get("/admin/credentials", async (c) => {
    const session = await currentAdmin(c.env, c.req.raw);
    if (session === undefined) return unauthorized();

    const credentials = await new D1AdminCredentialQueryRepository(c.env.D1).list();

    return Response.json(
      {
        credentials: credentials.map((credential) => ({
          id: credential.id.toString(),
          label: credential.label,
          algorithm: credential.algorithm,
          backedUp: credential.backedUp,
          createdAt: credential.createdAt.toString(),
          lastUsedAt: credential.lastUsedAt?.toString() ?? null,
          // いま使っている鍵。これを取り消すと自分が落ちるので、画面で断る。
          current: credential.id.equals(session.credentialId),
        })),
      },
      { headers: ADMIN_CACHE_HEADERS },
    );
  });

  app.delete("/admin/credentials/:id", async (c) => {
    const session = await currentAdmin(c.env, c.req.raw);
    if (session === undefined) return unauthorized();

    return guard(c, async () => {
      const id = CredentialId.create(c.req.param("id"));

      // 最後の 1 本は取り消させない。取り消すと誰も入れなくなり、D1 を手で
      // 触るまで復帰できない (ADR 0036)。
      const registered = await new D1AdminCredentialQueryRepository(c.env.D1).count();
      if (registered <= 1) {
        return createProblemResponse(
          httpStatus.CONFLICT,
          "Conflict",
          "the last passkey cannot be revoked; register another one first",
        );
      }

      await new D1AdminCredentialCommandRepository(c.env.D1).remove(id);
      return Response.json({ ok: true }, { headers: ADMIN_CACHE_HEADERS });
    });
  });

  return app;
};

/**
 * ドメインのエラーを HTTP に畳む (Composition Root の責務)。
 *
 * 認証の失敗はすべて 401 の同じ本文にする。どの段で落ちたかを返さない。
 */
async function guard(
  c: Context<{ Bindings: Env }>,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof RegistrationClosedError) {
      // 経路そのものを隠す。開いていないことを知らせる必要が無い。
      return notFoundResponse();
    }
    if (error instanceof RegistrationNotAllowedError) {
      return createProblemResponse(
        httpStatus.FORBIDDEN,
        "Forbidden",
        "registration is not allowed",
      );
    }
    if (error instanceof CredentialAlreadyRegisteredError) {
      return createProblemResponse(
        httpStatus.CONFLICT,
        "Conflict",
        "this passkey is already registered",
      );
    }
    if (error instanceof AdminAuthError) {
      // 記録には残す。返す側は 1 種類にまとめる。
      console.warn(`admin auth failed: ${error.name}: ${error.message}`);
      return unauthorized();
    }
    throw error;
  }
}

function unauthorized(): Response {
  return createProblemResponse(httpStatus.UNAUTHORIZED, "Unauthorized", "authentication failed");
}

/** bootstrap のときだけ要る登録用の secret。ヘッダーで受ける。 */
function readPresentedRegistrationToken(c: Context<{ Bindings: Env }>): string | undefined {
  return c.req.header("X-Admin-Registration-Token");
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new PayloadError("body is not JSON");
  }
  if (typeof body !== "object" || body === null) throw new PayloadError("body is not an object");
  return body as Record<string, unknown>;
}

/** 読めない本文。認証の失敗と同じ扱いにする (どこで落ちたかを返さない)。 */
class PayloadError extends AdminAuthError {
  readonly name = "PayloadError";
}

function readRegistrationResponse(body: Record<string, unknown>): RegistrationResponse {
  const id = requireString(body, "id");
  const response = requireObject(body, "response");
  return {
    id,
    clientDataJSON: requireString(response, "clientDataJSON"),
    attestationObject: requireString(response, "attestationObject"),
  };
}

function readAuthenticationResponse(body: Record<string, unknown>): AuthenticationResponse {
  const id = requireString(body, "id");
  const response = requireObject(body, "response");
  return {
    id,
    clientDataJSON: requireString(response, "clientDataJSON"),
    authenticatorData: requireString(response, "authenticatorData"),
    signature: requireString(response, "signature"),
  };
}

/** 鍵の名前。書かれていなければ「不明な端末」にする (名前は見分けのためだけ)。 */
function readLabel(body: Record<string, unknown>): string {
  const label = body.label;
  if (typeof label !== "string" || label.trim().length === 0) return "unnamed passkey";
  return label.trim().slice(0, MAX_LABEL_LENGTH);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new PayloadError(`${key} is missing`);
  }
  return value;
}

function requireObject(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (typeof value !== "object" || value === null) throw new PayloadError(`${key} is missing`);
  return value as Record<string, unknown>;
}
