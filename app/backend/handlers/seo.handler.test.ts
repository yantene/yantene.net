import { describe, expect, it } from "vitest";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { createTestApp } from "~/backend/test-app";

/**
 * robots.txt の出し分け。
 *
 * staging は BASIC 認証がある = 非公開環境なので全部止める。production は
 * 管理画面だけを止める。**止める対象を増やしたらここに足すこと。**
 */
function envFor(overrides: Partial<Record<string, unknown>> = {}): Env {
  return { D1: createTestD1(), APP_ENV: "test", ...overrides } as unknown as Env;
}

async function robotsTxt(env: Env, headers: Record<string, string> = {}): Promise<string> {
  const response = await createTestApp().request(
    "https://yantene.net/robots.txt",
    { headers },
    env,
  );
  expect(response.status).toBe(200);
  return response.text();
}

/** BASIC 認証のある環境は robots.txt まで守られる。確かめるには通り抜ける必要がある。 */
function basicAuth(user: string, pass: string): Record<string, string> {
  return { Authorization: `Basic ${btoa(`${user}:${pass}`)}` };
}

describe("GET /robots.txt", () => {
  it("公開環境では管理画面だけを止める", async () => {
    const body = await robotsTxt(envFor());

    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Sitemap: https://yantene.net/sitemap.xml");
  });

  it("BASIC 認証のある環境では全部止める", async () => {
    const body = await robotsTxt(
      envFor({ BASIC_AUTH_USER: "user", BASIC_AUTH_PASS: "pass" }),
      basicAuth("user", "pass"),
    );

    expect(body).toBe("User-agent: *\nDisallow: /\n");
    // 非公開環境では sitemap の在り処も教えない。
    expect(body).not.toContain("Sitemap");
  });
});

describe("GET /sitemap.xml", () => {
  it("管理画面は載せない", async () => {
    const response = await createTestApp().request("https://yantene.net/sitemap.xml", {}, envFor());

    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("/admin");
  });
});
