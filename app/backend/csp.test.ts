import { describe, expect, it } from "vitest";
import { createTestApp } from "~/backend/test-app";

/**
 * CSP は development でのみ外す (ADR 0007)。
 *
 * ここが黙って壊れると本番の防御が消えるため、環境ごとの挙動をテストで固定する。
 * 「development 以外なら必ず付く」ことを staging / production の両方で確認する。
 *
 * `style-src` の `'unsafe-inline'` は数式のために意図して置いたもの (ADR 0019)。
 * **`script-src` には決して足さないこと。** そちらは XSS 緩和の本体で、緩めると
 * CSP を持つ意味がほぼ無くなる。下のテストがそれを見張る。
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
    expect(await cspOf("staging")).toContain("style-src 'self'");
  });

  it("enforces the CSP in production", async () => {
    expect(await cspOf("production")).toContain("style-src 'self'");
  });

  /*
   * 数式のために緩めたのは style-src だけ (ADR 0019)。script-src まで一緒に緩むと
   * XSS 緩和が消えるので、両者を別々に固定する。
   */
  it("never allows inline script, even though inline style is allowed", async () => {
    for (const appEnv of ["staging", "production", "unexpected"]) {
      const directives = await directivesOf(appEnv);
      const scriptSrc = directives.find((d) => d.startsWith("script-src"));
      expect(scriptSrc).toBeDefined();
      expect(scriptSrc).not.toContain("unsafe-inline");
      expect(scriptSrc).not.toContain("unsafe-eval");
      // nonce を配って自前の inline script だけ通す形は維持する。
      expect(scriptSrc).toContain("nonce-");
    }
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
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
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
