import { Hono } from "hono";
import { Temporal } from "@js-temporal/polyfill";
import type { Context } from "hono";
import type { SignInToken } from "~/backend/domain/auth";
import { EmailAddress, SignInRequestId, SignInToken as SignInTokenVo } from "~/backend/domain/auth";
import { currentAccount, PRIVATE_CACHE_HEADERS } from "./current-account";
import {
  buildAuthSessionCookie,
  buildClearedAuthSessionCookie,
  readAuthSessionId,
} from "./auth-session-cookie";
import {
  buildClearedSignInRequestCookie,
  buildClearedSignInTokenCookie,
  buildSignInRequestCookie,
  buildSignInTokenCookie,
  readSignInRequestId,
  readSignInToken,
} from "./sign-in-cookies";
import { resolveRateLimiter, resolveSignInService, shouldUseSecureCookie } from "./resolve-sign-in";
import { httpStatus } from "~/lib/constants/http-status";
import {
  signInCallbackPath,
  signInConfirmPath,
  signInEmailField,
  signInExpiredParam,
  signInInvalidParam,
  signInPath,
  signInSentPath,
  signInTokenParam,
  signOutPath,
} from "~/lib/constants/sign-in";
import { resolveLocaleOrDefault } from "~/lib/i18n/resolve-locale";
import { createProblemResponse } from "~/lib/problem-details";

/** 入った後の行き先。 */
const HOME_PATH = "/";

/** 同じ IP から 1 分間に受けるリンクの依頼の数。窓は 10 秒か 60 秒しか選べない。 */
const RATE_LIMIT_PREFIX = "sign-in";

function seeOther(location: string, setCookies: readonly string[]): Response {
  const headers = new Headers({ Location: location });
  for (const cookie of setCookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: httpStatus.SEE_OTHER, headers });
}

/**
 * 別のサイトから送られてきた POST を落とす。
 *
 * 開けておくと、攻撃者が自分のリンクを他人のブラウザに踏ませて**攻撃者として
 * ログインさせられる** (login CSRF)。`Origin` を送らない相手は通す — 送らないのは
 * 古いブラウザだけで、落とすとその人が入れなくなる。cookie 側は `SameSite=Lax` なので、
 * 他所からの POST にはそもそもトークンが乗らない (二重の守り)。
 */
function isCrossSitePost(c: Context<{ Bindings: Env }>): boolean {
  const origin = c.req.header("origin");
  /*
   * 送ってこない相手だけを通す。**`null` は通さない** — 素のフォームからの POST が
   * `null` を送ることはなく、これを吐くのは砂箱の iframe とオリジンをまたぐ
   * リダイレクトの側だから。攻撃者が作れる唯一の値をここで拾わない。
   */
  if (origin === undefined) return false;

  try {
    return new URL(origin).origin !== new URL(c.req.url).origin;
  } catch {
    return true;
  }
}

/** 本文をフォームとして読む。読めなければ null (投げさせない)。 */
async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

/** リンクを組み立てる。メールに載る唯一の URL。 */
function buildCallbackUrl(requestUrl: string, token: SignInToken): string {
  const url = new URL(signInCallbackPath, requestUrl);
  url.searchParams.set(signInTokenParam, token.toString());
  return url.toString();
}

/**
 * ログインの経路 (ADR 0039)。
 *
 * ```
 * POST /sign-in            リンクを送る (送ったかどうかは答えない)
 * GET  /sign-in/callback   メールのリンクの行き先。**ここでは使い切らない**
 * POST /sign-in/confirm    使い切ってセッションを配る
 * POST /sign-out
 * GET  /api/v1/me          ログイン中かを返す
 * ```
 *
 * 画面 (`GET /sign-in` など) は React Router 側にある。ここが受け持つのは副作用だけで、
 * **どれも素の `<form>` で動く** (JavaScript を前提にしない)。
 */
export function createSignInRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  /*
   * リンクを送る。
   *
   * **応答はアドレスによって変わらない。** 送っても送らなくても同じ場所へ送り返す。
   * 変えると、誰がこのサイトに入れるのかを総当たりで数えられる。
   */
  router.post(signInPath, async (c) => {
    if (isCrossSitePost(c)) {
      return createProblemResponse(httpStatus.FORBIDDEN, "Forbidden", "Cross-site request.");
    }

    const client = c.req.header("cf-connecting-ip") ?? "unknown";
    const allowed = await resolveRateLimiter(c.env).allow(`${RATE_LIMIT_PREFIX}:${client}`);
    if (!allowed) {
      return createProblemResponse(
        httpStatus.TOO_MANY_REQUESTS,
        "Too Many Requests",
        "Too many sign-in requests. Please wait a moment.",
      );
    }

    const form = await readForm(c.req.raw);
    const raw = form?.get(signInEmailField);
    const email = typeof raw === "string" ? EmailAddress.parse(raw) : undefined;

    /*
     * 読めないアドレスだけは打った本人に返す。**これは「登録済みか」ではなく
     * 「打ち間違いか」**なので、答えても誰がいるかは漏れない。黙って送ったことに
     * すると、打ち間違えた人がいつまでも来ないメールを待つ。
     */
    if (email === undefined) {
      return seeOther(`${signInPath}?${signInInvalidParam}`, []);
    }

    const requestId = SignInRequestId.issue();
    const service = resolveSignInService(c.env);
    const work = service.requestLink({
      email,
      requestId,
      buildUrl: (token) => buildCallbackUrl(c.req.url, token),
      locale: resolveLocaleOrDefault(c.req.raw),
      at: Temporal.Now.instant(),
    });

    /*
     * 送り終わるのを待たない。**待つと、許されたアドレスだけ応答が遅くなる**ので、
     * 返事を揃えた意味が無くなる。落ちたことは service が記録に残す。
     */
    c.executionCtx.waitUntil(work);

    return seeOther(signInSentPath, [
      buildSignInRequestCookie(requestId, { secure: shouldUseSecureCookie(c.env) }),
    ]);
  });

  /*
   * メールのリンクの行き先。**ここではトークンを使い切らない** (ADR 0039)。
   *
   * 会社のメールのリンク検査は `GET` しかしないので、ここで消費すると本人より先に
   * 踏み潰される。頼んだブラウザ自身だと分かるときだけ、近道としてその場で入れる。
   */
  router.get(signInCallbackPath, async (c) => {
    const secure = shouldUseSecureCookie(c.env);
    const token = SignInTokenVo.parse(c.req.query(signInTokenParam) ?? "");
    if (token === undefined) return seeOther(signInConfirmPath, []);

    const requestId = readSignInRequestId(c.req.header("cookie") ?? null, { secure });
    if (requestId !== undefined) {
      const session = await resolveSignInService(c.env).completeSignIn({
        token,
        at: Temporal.Now.instant(),
        requestId,
      });
      // 外したときは行が残る。確認の画面からやり直せる。
      if (session !== undefined) {
        return seeOther(HOME_PATH, [
          buildAuthSessionCookie(session.id, { secure }),
          buildClearedSignInRequestCookie({ secure }),
        ]);
      }
    }

    /*
     * トークンを cookie に移して、素の URL へ送り直す。
     *
     * `?token=...` のまま画面を描くと、閲覧の計測 (ADR 0021) の送り先と履歴に
     * トークンが載る。**載った時点でそのリンクは秘密でなくなる。**
     */
    return seeOther(signInConfirmPath, [buildSignInTokenCookie(token, { secure })]);
  });

  /* 確認の画面の押し場所。ここで初めて使い切る。 */
  router.post(signInConfirmPath, async (c) => {
    if (isCrossSitePost(c)) {
      return createProblemResponse(httpStatus.FORBIDDEN, "Forbidden", "Cross-site request.");
    }

    const secure = shouldUseSecureCookie(c.env);
    const token = readSignInToken(c.req.header("cookie") ?? null, { secure });
    if (token === undefined) return seeOther(`${signInConfirmPath}?${signInExpiredParam}`, []);

    const session = await resolveSignInService(c.env).completeSignIn({
      token,
      at: Temporal.Now.instant(),
    });
    if (session === undefined) {
      return seeOther(`${signInConfirmPath}?${signInExpiredParam}`, [
        buildClearedSignInTokenCookie({ secure }),
      ]);
    }

    return seeOther(HOME_PATH, [
      buildAuthSessionCookie(session.id, { secure }),
      buildClearedSignInTokenCookie({ secure }),
      buildClearedSignInRequestCookie({ secure }),
    ]);
  });

  router.post(signOutPath, async (c) => {
    if (isCrossSitePost(c)) {
      return createProblemResponse(httpStatus.FORBIDDEN, "Forbidden", "Cross-site request.");
    }

    const secure = shouldUseSecureCookie(c.env);
    const id = readAuthSessionId(c.req.header("cookie") ?? null, { secure });
    // 持っていない相手にも同じ場所を返す。cookie は念のため捨てさせる。
    if (id !== undefined) await resolveSignInService(c.env).signOut(id);

    return seeOther(HOME_PATH, [buildClearedAuthSessionCookie({ secure })]);
  });

  /*
   * ログイン中かを返す。
   *
   * **ログインの表示をサーバー側で描かないための口** (#480)。描くと HTML が人によって
   * 変わり、経路のどこかで他人に配られる危険とハイドレーションの穴が増える。
   */
  router.get("/api/v1/me", async (c) => {
    const account = await currentAccount(c.env, c.req.raw);

    return c.json(
      account === undefined
        ? { signedIn: false as const }
        : { signedIn: true as const, email: account.email.toString(), admin: account.admin },
      httpStatus.OK,
      PRIVATE_CACHE_HEADERS,
    );
  });

  return router;
}
