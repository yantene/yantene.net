/*
 * @vitest-environment node
 *
 * 既定の happy-dom は fetch 仕様に従って `cookie` を forbidden header として剥がすため、
 * リクエストにセッションを載せられない。ここは認証そのものを確かめるので、ヘッダーを
 * そのまま通す node で走らせる。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { adminSessionCookieName } from "./admin-session-cookie";
import { FakeAuthenticator } from "~/backend/infra/webauthn/test-helper";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { createTestKv } from "~/backend/infra/kv/test-helper";
import { createTestApp } from "~/backend/test-app";

const ORIGIN = "https://yantene.net";
const RP_ID = "yantene.net";
const COOKIE_NAME = adminSessionCookieName(true);

const TOKEN = "bootstrap-token-that-is-long-enough";

interface Harness {
  readonly env: Env;
  /** 応答が返した管理者セッションの cookie。次のリクエストへ持ち回る。 */
  cookie: string;
}

function setup(overrides: Partial<Record<string, unknown>> = {}): Harness {
  const { kv } = createTestKv();
  return {
    env: {
      D1: createTestD1(),
      SESSIONS: kv,
      APP_ENV: "test",
      ADMIN_REGISTRATION_TOKEN: TOKEN,
      ...overrides,
    } as unknown as Env,
    cookie: "",
  };
}

async function call(
  harness: Harness,
  path: string,
  init: { method: string; body?: unknown; headers?: Record<string, string> },
): Promise<Response> {
  const response = await createTestApp().request(
    `${ORIGIN}${path}`,
    {
      method: init.method,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      headers: {
        ...(harness.cookie === "" ? {} : { cookie: harness.cookie }),
        ...init.headers,
      },
    },
    harness.env,
  );

  const issued = response.headers.get("set-cookie");
  if (issued !== null && issued.includes(COOKIE_NAME)) {
    harness.cookie = issued.split(";", 1)[0] ?? "";
  }
  return response;
}

/** bootstrap の secret を示して passkey を 1 本登録する。 */
async function register(
  harness: Harness,
  authenticator: FakeAuthenticator,
  options: { token?: string; label?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> =
    options.token === undefined ? {} : { "X-Admin-Registration-Token": options.token };

  const optionsResponse = await call(harness, "/api/v1/admin/registration-options", {
    method: "POST",
    headers,
  });
  if (!optionsResponse.ok) return optionsResponse;

  const { challenge } = (await optionsResponse.json()) as { challenge: string };
  const created = await authenticator.register(challenge);

  return call(harness, "/api/v1/admin/registration", {
    method: "POST",
    headers,
    body: {
      id: created.id,
      label: options.label ?? "test key",
      response: {
        clientDataJSON: created.clientDataJSON,
        attestationObject: created.attestationObject,
      },
    },
  });
}

/** ログインする。 */
async function signIn(harness: Harness, authenticator: FakeAuthenticator): Promise<Response> {
  const optionsResponse = await call(harness, "/api/v1/admin/session-options", { method: "POST" });
  const { challenge } = (await optionsResponse.json()) as { challenge: string };
  const assertion = await authenticator.authenticate(challenge);

  return call(harness, "/api/v1/admin/session", {
    method: "POST",
    body: {
      id: assertion.id,
      response: {
        clientDataJSON: assertion.clientDataJSON,
        authenticatorData: assertion.authenticatorData,
        signature: assertion.signature,
      },
    },
  });
}

let authenticator: FakeAuthenticator;

beforeEach(async () => {
  authenticator = await FakeAuthenticator.create({ rpId: RP_ID, origin: ORIGIN });
});

describe("登録 (bootstrap)", () => {
  it("鍵が 1 本も無ければ、secret を示した要求が登録できる", async () => {
    const harness = setup();
    const response = await register(harness, authenticator, { token: TOKEN });
    expect(response.status).toBe(201);
  });

  it("secret が違えば断る", async () => {
    const harness = setup();
    const response = await register(harness, authenticator, { token: "wrong" });
    expect(response.status).toBe(403);
  });

  it("secret を示さなければ断る", async () => {
    const harness = setup();
    const response = await register(harness, authenticator, {});
    expect(response.status).toBe(403);
  });

  it("secret が設定されていなければ経路そのものを隠す", async () => {
    const harness = setup({ ADMIN_REGISTRATION_TOKEN: undefined });
    const response = await register(harness, authenticator, { token: TOKEN });
    expect(response.status).toBe(404);
  });

  it("1 本でもあれば、secret だけでは追加登録できない", async () => {
    const harness = setup();
    expect((await register(harness, authenticator, { token: TOKEN })).status).toBe(201);

    const second = await FakeAuthenticator.create({ rpId: RP_ID, origin: ORIGIN });
    // cookie を持たない (ログインしていない) 状態で、secret だけを示す。
    const response = await register(harness, second, { token: TOKEN });
    expect(response.status).toBe(403);
  });

  it("ログイン中なら追加登録できる", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);

    const second = await FakeAuthenticator.create({ rpId: RP_ID, origin: ORIGIN });
    expect((await register(harness, second, {})).status).toBe(201);
  });

  it("secret を消したあとでも、サインイン中なら追加登録できる", async () => {
    // bootstrap が済んだら secret は要らない、と .dev.vars.example にも書いてある。
    // **書いたとおりに消したら復旧用の端末を足せなくなる**のでは話が合わない。
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);

    const withoutToken: Harness = {
      env: { ...harness.env, ADMIN_REGISTRATION_TOKEN: undefined } as unknown as Env,
      cookie: harness.cookie,
    };
    const second = await FakeAuthenticator.create({ rpId: RP_ID, origin: ORIGIN });
    expect((await register(withoutToken, second, {})).status).toBe(201);
  });

  it("同じ鍵を 2 度登録したら断る", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);

    const response = await register(harness, authenticator, {});
    expect(response.status).toBe(409);
  });

  it("すでに登録済みの鍵は excludeCredentials に載る", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);

    const response = await call(harness, "/api/v1/admin/registration-options", { method: "POST" });
    const options = (await response.json()) as { excludeCredentials: { id: string }[] };
    expect(options.excludeCredentials.map((entry) => entry.id)).toEqual([
      authenticator.credentialIdBase64Url,
    ]);
  });
});

describe("ログイン", () => {
  it("登録した鍵でログインでき、cookie が返る", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });

    const response = await signIn(harness, authenticator);
    expect(response.status).toBe(200);

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
  });

  it("読み手のセッションとは別の cookie を使う", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    const response = await signIn(harness, authenticator);
    // 読み手の "session=" と混ざらないこと。併せて __Host- 前置が付くこと
    // (他のホストから置き換えられないようにするため)。
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^__Host-admin-session=/);
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Domain=");
  });

  it("登録していない鍵ではログインできない", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });

    const stranger = await FakeAuthenticator.create({ rpId: RP_ID, origin: ORIGIN });
    expect((await signIn(harness, stranger)).status).toBe(401);
  });

  it("同じチャレンジを 2 度は使えない", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });

    const optionsResponse = await call(harness, "/api/v1/admin/session-options", {
      method: "POST",
    });
    const { challenge } = (await optionsResponse.json()) as { challenge: string };

    const body = async (): Promise<unknown> => {
      const assertion = await authenticator.authenticate(challenge);
      return {
        id: assertion.id,
        response: {
          clientDataJSON: assertion.clientDataJSON,
          authenticatorData: assertion.authenticatorData,
          signature: assertion.signature,
        },
      };
    };

    expect(
      (await call(harness, "/api/v1/admin/session", { method: "POST", body: await body() })).status,
    ).toBe(200);
    expect(
      (await call(harness, "/api/v1/admin/session", { method: "POST", body: await body() })).status,
    ).toBe(401);
  });

  it("発行していないチャレンジは通らない", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });

    const assertion = await authenticator.authenticate("A".repeat(43));
    const response = await call(harness, "/api/v1/admin/session", {
      method: "POST",
      body: {
        id: assertion.id,
        response: {
          clientDataJSON: assertion.clientDataJSON,
          authenticatorData: assertion.authenticatorData,
          signature: assertion.signature,
        },
      },
    });
    expect(response.status).toBe(401);
  });

  it("登録用のチャレンジではログインできない", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);

    const optionsResponse = await call(harness, "/api/v1/admin/registration-options", {
      method: "POST",
    });
    const { challenge } = (await optionsResponse.json()) as { challenge: string };
    const assertion = await authenticator.authenticate(challenge);

    const response = await call(harness, "/api/v1/admin/session", {
      method: "POST",
      body: {
        id: assertion.id,
        response: {
          clientDataJSON: assertion.clientDataJSON,
          authenticatorData: assertion.authenticatorData,
          signature: assertion.signature,
        },
      },
    });
    expect(response.status).toBe(401);
  });

  it("失敗の応答は理由を区別しない", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });

    const stranger = await FakeAuthenticator.create({ rpId: RP_ID, origin: ORIGIN });
    const unknownCredential = await signIn(harness, stranger);
    const staleChallenge = await call(harness, "/api/v1/admin/session", {
      method: "POST",
      body: {
        id: "AAAA",
        response: { clientDataJSON: "e30", authenticatorData: "AA", signature: "AA" },
      },
    });

    expect(unknownCredential.status).toBe(staleChallenge.status);
    expect(await unknownCredential.json()).toEqual(await staleChallenge.json());
  });

  it("本文が読めなくても 401 に揃える", async () => {
    const harness = setup();
    const response = await call(harness, "/api/v1/admin/session", {
      method: "POST",
      body: { nope: true },
    });
    expect(response.status).toBe(401);
  });
});

describe("セッション", () => {
  it("ログアウトすると鍵の一覧が引けなくなる", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);

    expect((await call(harness, "/api/v1/admin/credentials", { method: "GET" })).status).toBe(200);

    await call(harness, "/api/v1/admin/session", { method: "DELETE" });
    expect((await call(harness, "/api/v1/admin/credentials", { method: "GET" })).status).toBe(401);
  });

  it("ログインしていなければ鍵の一覧は引けない", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    expect((await call(harness, "/api/v1/admin/credentials", { method: "GET" })).status).toBe(401);
  });

  it("管理者が見る応答はキャッシュさせない", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);

    const response = await call(harness, "/api/v1/admin/credentials", { method: "GET" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toContain("Cookie");
  });

  it("読めないセッション識別子はログインしていない扱いになる", async () => {
    const harness = setup();
    harness.cookie = `${COOKIE_NAME}=not-a-valid-id`;
    expect((await call(harness, "/api/v1/admin/credentials", { method: "GET" })).status).toBe(401);
  });
});

describe("鍵の取り消し", () => {
  it("取り消した鍵で開いていたセッションは、その場で畳まれる", async () => {
    // 取り消しがいちばん要るのは端末を失ったときで、そのとき相手はセッションを
    // 使い続けている。**触るたびに期限が延びるので、畳まないと永遠に切れない。**
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);

    const second = await FakeAuthenticator.create({ rpId: RP_ID, origin: ORIGIN });
    await register(harness, second, {});

    // 失くした端末 (second) のセッションを別に開く。
    const lost: Harness = { env: harness.env, cookie: "" };
    expect((await signIn(lost, second)).status).toBe(200);
    expect((await call(lost, "/api/v1/admin/credentials", { method: "GET" })).status).toBe(200);

    // 手元の端末から取り消す。
    const revoked = await call(
      harness,
      `/api/v1/admin/credentials/${second.credentialIdBase64Url}`,
      { method: "DELETE" },
    );
    expect(revoked.status).toBe(200);

    // 失くした端末のセッションはもう通らない。
    expect((await call(lost, "/api/v1/admin/credentials", { method: "GET" })).status).toBe(401);
  });

  it("いま使っている鍵は取り消せない", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);
    const second = await FakeAuthenticator.create({ rpId: RP_ID, origin: ORIGIN });
    await register(harness, second, {});

    const response = await call(
      harness,
      `/api/v1/admin/credentials/${authenticator.credentialIdBase64Url}`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(409);
  });

  it("読めない credential id は 400 にする (500 にしない)", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);

    const response = await call(harness, "/api/v1/admin/credentials/not%21valid", {
      method: "DELETE",
    });
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
  });

  it("最後の 1 本は取り消せない", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);

    const response = await call(
      harness,
      `/api/v1/admin/credentials/${authenticator.credentialIdBase64Url}`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(409);
  });

  it("いま使っていない鍵は取り消せる", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);
    const second = await FakeAuthenticator.create({ rpId: RP_ID, origin: ORIGIN });
    await register(harness, second, {});

    const response = await call(
      harness,
      `/api/v1/admin/credentials/${second.credentialIdBase64Url}`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(200);

    const listed = (await (
      await call(harness, "/api/v1/admin/credentials", { method: "GET" })
    ).json()) as { credentials: { id: string }[] };
    expect(listed.credentials.map((entry) => entry.id)).toEqual([
      authenticator.credentialIdBase64Url,
    ]);
  });

  it("取り消した鍵ではログインできない", async () => {
    const harness = setup();
    await register(harness, authenticator, { token: TOKEN });
    await signIn(harness, authenticator);
    const second = await FakeAuthenticator.create({ rpId: RP_ID, origin: ORIGIN });
    await register(harness, second, {});

    await call(harness, `/api/v1/admin/credentials/${second.credentialIdBase64Url}`, {
      method: "DELETE",
    });
    harness.cookie = "";
    expect((await signIn(harness, second)).status).toBe(401);
  });
});
