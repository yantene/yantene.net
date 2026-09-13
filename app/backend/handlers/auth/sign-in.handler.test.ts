/*
 * @vitest-environment node
 *
 * 既定の happy-dom は fetch 仕様に従って `cookie` を forbidden header として剥がすため、
 * リクエストに cookie を載せられない。ここは cookie の往復そのものを確かめるので、
 * ヘッダーをそのまま通す node で走らせる。
 */
import { describe, expect, it } from "vitest";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { createTestKv } from "~/backend/infra/kv/test-helper";
import { createTestApp } from "~/backend/test-app";
import { signInCallbackPath, signInConfirmPath, signInPath } from "~/lib/constants/sign-in";

const ADMIN_EMAIL = "contact@yantene.net";
const STRANGER_EMAIL = "someone-else@example.com";
const ORIGIN = "https://yantene.net";

interface SentMail {
  readonly to: string;
  readonly text: string;
}

interface Harness {
  readonly env: Env;
  readonly sent: SentMail[];
  /** 応答が置いた cookie を名前ごとに持ち回る (ブラウザの代わり)。 */
  readonly jar: Map<string, string>;
}

function setup(options?: { readonly rateLimited?: boolean }): Harness {
  const sent: SentMail[] = [];

  const env = {
    D1: createTestD1(),
    SESSIONS: createTestKv().kv,
    APP_ENV: "test",
    ADMIN_EMAIL,
    MAIL_FROM: "no-reply@send.yantene.net",
    EMAIL: {
      send: (message: { to: string; text?: string }) => {
        sent.push({ to: message.to, text: message.text ?? "" });
        return Promise.resolve({});
      },
    },
    RATE_LIMIT: {
      limit: () => Promise.resolve({ success: options?.rateLimited !== true }),
    },
  } as unknown as Env;

  return { env, sent, jar: new Map() };
}

/** 応答の Set-Cookie を cookie 入れに写す。`Max-Age=0` は捨てる。 */
function absorb(harness: Harness, response: Response): void {
  for (const raw of response.headers.getSetCookie()) {
    const [pair = ""] = raw.split(";", 1);
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value.length === 0) harness.jar.delete(name);
    else harness.jar.set(name, value);
  }
}

function cookieHeader(harness: Harness): Record<string, string> {
  if (harness.jar.size === 0) return {};
  return {
    cookie: [...harness.jar].map(([name, value]) => `${name}=${value}`).join("; "),
  };
}

/** 待たずに返す経路 (waitUntil) を、テストでは待ってから次へ進む。 */
async function call(
  harness: Harness,
  path: string,
  init: RequestInit = {},
  options?: { readonly withCookies?: boolean },
): Promise<Response> {
  const pending: Promise<unknown>[] = [];
  const response = await createTestApp().request(
    `${ORIGIN}${path}`,
    {
      ...init,
      headers: {
        ...(options?.withCookies === false ? {} : cookieHeader(harness)),
        ...(init.headers as Record<string, string> | undefined),
      },
    },
    harness.env,
    {
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
      passThroughOnException: () => undefined,
    } as unknown as ExecutionContext,
  );

  await Promise.all(pending);
  if (options?.withCookies !== false) absorb(harness, response);
  return response;
}

function requestLink(harness: Harness, email: string): Promise<Response> {
  return call(harness, signInPath, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email }).toString(),
  });
}

/** 送られたメールの本文からリンクの path + query を取り出す。 */
function linkFrom(mail: SentMail): string {
  const found = /https?:\/\/\S+/.exec(mail.text)?.[0];
  if (found === undefined) throw new Error("the mail carried no link");
  const url = new URL(found);
  return `${url.pathname}${url.search}`;
}

describe("ログインの受け口", () => {
  it("入れるアドレスにはリンクが届く", async () => {
    const harness = setup();

    const response = await requestLink(harness, ADMIN_EMAIL);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/sign-in/sent");
    expect(harness.sent).toHaveLength(1);
    expect(harness.sent[0].to).toBe(ADMIN_EMAIL);
  });

  /*
   * **応答で区別しない** (ADR 0039)。分けると、誰がこのサイトに入れるのかを
   * 総当たりで数えられる。
   */
  it("入れないアドレスでも応答が変わらない", async () => {
    const allowed = setup();
    const stranger = setup();

    const a = await requestLink(allowed, ADMIN_EMAIL);
    const b = await requestLink(stranger, STRANGER_EMAIL);

    expect(b.status).toBe(a.status);
    expect(b.headers.get("location")).toBe(a.headers.get("location"));
    expect(stranger.sent).toHaveLength(0);
  });

  it("アドレスの形になっていなければ打った本人に返す", async () => {
    const harness = setup();

    const response = await requestLink(harness, "not-an-address");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/sign-in?invalid");
    expect(harness.sent).toHaveLength(0);
  });

  it("連打は止める", async () => {
    const harness = setup({ rateLimited: true });

    const response = await requestLink(harness, ADMIN_EMAIL);

    expect(response.status).toBe(429);
    expect(harness.sent).toHaveLength(0);
  });

  /*
   * **この 1 本がこの設計の要** (ADR 0039)。会社のメールのリンク検査は `GET` しか
   * しないので、`GET` で使い切ると本人より先に踏み潰される。
   */
  it("リンクを GET しただけでは使い切らない", async () => {
    const harness = setup();
    await requestLink(harness, ADMIN_EMAIL);
    const link = linkFrom(harness.sent[0]);

    // 検査器のように、cookie を持たないまま踏む。
    const scanned = await call(harness, link, {}, { withCookies: false });
    expect(scanned.status).toBe(303);
    expect(scanned.headers.get("location")).toBe(signInConfirmPath);
    expect(scanned.headers.getSetCookie().some((c) => c.includes("auth="))).toBe(false);

    // 本人が後から踏んでも、まだ使える。
    const human = await call(harness, link, {}, { withCookies: false });
    expect(human.headers.get("location")).toBe(signInConfirmPath);
    absorb(harness, human);

    const done = await call(harness, signInConfirmPath, {
      method: "POST",
      headers: { origin: ORIGIN },
    });
    expect(done.status).toBe(303);
    expect(done.headers.get("location")).toBe("/");
    expect(harness.jar.has("__Host-auth")).toBe(true);
  });

  it("トークンを素の URL に移し替えてから画面を描く", async () => {
    const harness = setup();
    await requestLink(harness, ADMIN_EMAIL);
    const link = linkFrom(harness.sent[0]);

    const response = await call(harness, link, {}, { withCookies: false });

    // 行き先にトークンが残らない (閲覧の計測と履歴に載せない)。
    expect(response.headers.get("location")).toBe(signInConfirmPath);
    expect(response.headers.get("location")).not.toContain("token");
  });

  it("頼んだブラウザから踏まれたときは確認を挟まない", async () => {
    const harness = setup();
    await requestLink(harness, ADMIN_EMAIL);
    const link = linkFrom(harness.sent[0]);

    const response = await call(harness, link);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    expect(harness.jar.has("__Host-auth")).toBe(true);
  });

  it("使い切ったリンクは二度目が通らない", async () => {
    const harness = setup();
    await requestLink(harness, ADMIN_EMAIL);
    const link = linkFrom(harness.sent[0]);
    absorb(harness, await call(harness, link, {}, { withCookies: false }));

    // 同じトークンをもう一度送れるよう、消される前に控えておく。
    const held = harness.jar.get("__Host-sign-in-token");
    expect(held).toBeDefined();

    const first = await call(harness, signInConfirmPath, {
      method: "POST",
      headers: { origin: ORIGIN },
    });
    expect(first.headers.get("location")).toBe("/");

    // まったく同じトークンを持ち出しても、行はもう無い。
    const second = await call(
      harness,
      signInConfirmPath,
      {
        method: "POST",
        headers: { origin: ORIGIN, cookie: `__Host-sign-in-token=${held ?? ""}` },
      },
      { withCookies: false },
    );
    expect(second.headers.get("location")).toBe(`${signInConfirmPath}?expired`);
  });

  /*
   * 開けておくと、攻撃者が自分のリンクを他人のブラウザに踏ませて**攻撃者として
   * ログインさせられる** (login CSRF)。
   */
  it("他所のサイトから送られてきた POST は落とす", async () => {
    const harness = setup();

    for (const path of [signInPath, signInConfirmPath, "/sign-out"]) {
      const response = await call(harness, path, {
        method: "POST",
        headers: { origin: "https://evil.example" },
      });
      expect(response.status).toBe(403);
    }
    expect(harness.sent).toHaveLength(0);
  });

  /** 素のフォームは `null` を送らない。これを吐くのは砂箱の iframe の側。 */
  it("Origin: null も落とす", async () => {
    const harness = setup();

    const response = await call(harness, signInPath, {
      method: "POST",
      headers: { origin: "null", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: ADMIN_EMAIL }).toString(),
    });

    expect(response.status).toBe(403);
    expect(harness.sent).toHaveLength(0);
  });

  it("読めないトークンで踏まれても確認の画面へ送る", async () => {
    const harness = setup();

    const response = await call(harness, `${signInCallbackPath}?token=nope`);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(signInConfirmPath);
  });
});

describe("GET /api/v1/me", () => {
  it("ログインしていなければ signedIn: false", async () => {
    const harness = setup();

    const response = await call(harness, "/api/v1/me");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ signedIn: false });
    // 人によって変わる応答は経路に載せない。
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("ログインしていれば誰なのかを返し、管理者かどうかも言う", async () => {
    const harness = setup();
    await requestLink(harness, ADMIN_EMAIL);
    await call(harness, linkFrom(harness.sent[0]));

    const response = await call(harness, "/api/v1/me");

    expect(await response.json()).toEqual({
      signedIn: true,
      email: ADMIN_EMAIL,
      admin: true,
    });
  });

  it("ログアウトすると戻る", async () => {
    const harness = setup();
    await requestLink(harness, ADMIN_EMAIL);
    await call(harness, linkFrom(harness.sent[0]));

    const out = await call(harness, "/sign-out", {
      method: "POST",
      headers: { origin: ORIGIN },
    });
    expect(out.headers.get("location")).toBe("/");

    expect(await (await call(harness, "/api/v1/me")).json()).toEqual({ signedIn: false });
  });
});
