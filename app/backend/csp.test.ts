import { describe, expect, it } from "vitest";
import { createTestApp } from "~/backend/test-app";

/**
 * CSP は development でのみ外す (ADR 0007)。
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

  /*
   * 外に開いているホストは、開いた理由と対で固定する (ADR 0017)。
   *
   * ディレクティブ 1 つを丸ごと取り出して突き合わせる。`toContain` で部分一致を見ると
   * `connect-src 'self' https://somewhere.example` も「`connect-src 'self'` を含む」ため
   * 通ってしまい、**歯止めにならない** (足された分を検出できない)。
   */
  async function directivesOf(appEnv: string): Promise<string[]> {
    const csp = await cspOf(appEnv);
    return (csp ?? "").split(";").map((directive) => directive.trim());
  }

  it("opens style-src and font-src to Google Fonts, and nothing else", async () => {
    const directives = await directivesOf("production");

    expect(directives).toContain(
      "style-src 'self' https://fonts.googleapis.com",
    );
    expect(directives).toContain("font-src 'self' https://fonts.gstatic.com");
    // フォントを読むのに要らない口は 'self' のままであること (増えたらここで落ちる)。
    expect(directives).toContain("default-src 'self'");
    expect(directives).toContain("connect-src 'self'");
    expect(directives).toContain("img-src 'self' data:");
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
