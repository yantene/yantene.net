import { describe, expect, it } from "vitest";
import { createTestApp } from "~/backend/test-app";

/**
 * CSP は development でのみ外す (ADR 0011)。
 *
 * ここが黙って壊れると本番の防御が消えるため、環境ごとの挙動をテストで固定する。
 * 「development 以外なら必ず付く」ことを staging / production の両方で確認する。
 */
describe("content security policy", () => {
  function env(appEnv: string): Env {
    return { APP_ENV: appEnv } as unknown as Env;
  }

  async function cspOf(appEnv: string): Promise<string | null> {
    const res = await createTestApp().request("/health", {}, env(appEnv));
    return res.headers.get("Content-Security-Policy");
  }

  it("omits the CSP in development (Vite injects CSS as inline <style>)", async () => {
    expect(await cspOf("development")).toBeNull();
  });

  it("enforces the CSP in staging", async () => {
    const csp = await cspOf("staging");
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain("unsafe-inline");
  });

  it("enforces the CSP in production", async () => {
    const csp = await cspOf("production");
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain("unsafe-inline");
  });

  it("falls back to enforcing the CSP for an unknown APP_ENV (secure by default)", async () => {
    expect(await cspOf("")).toContain("style-src 'self'");
    expect(await cspOf("unexpected")).toContain("style-src 'self'");
  });

  it("keeps the other security headers in every environment", async () => {
    for (const appEnv of ["development", "staging", "production"]) {
      const res = await createTestApp().request("/health", {}, env(appEnv));
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      expect(res.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(res.headers.get("Strict-Transport-Security")).toContain(
        "max-age=31536000",
      );
    }
  });
});
