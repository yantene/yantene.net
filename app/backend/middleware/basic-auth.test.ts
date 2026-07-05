import { describe, expect, it } from "vitest";
import app from "~/backend/index";

const basicAuthEnv = {
  BASIC_AUTH_USER: "u",
  BASIC_AUTH_PASS: "p",
} as unknown as Env;

describe("conditionalBasicAuth (full app)", () => {
  it("challenges with WWW-Authenticate so browsers show the auth dialog", async () => {
    const res = await app.request("/health", {}, basicAuthEnv);
    expect(res.status).toBe(401);
    // RFC 7235: チャレンジヘッダが無いとブラウザは BASIC 認証ダイアログを出さない。
    expect(res.headers.get("WWW-Authenticate")).toMatch(/^Basic/);
  });

  it("allows the request with correct credentials", async () => {
    const res = await app.request(
      "/health",
      { headers: { Authorization: `Basic ${btoa("u:p")}` } },
      basicAuthEnv,
    );
    expect(res.status).toBe(200);
  });

  it("is disabled when credentials are not configured", async () => {
    const res = await app.request("/health", {}, {});
    expect(res.status).toBe(200);
  });
});
