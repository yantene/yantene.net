import { describe, expect, it } from "vitest";
import app from "~/backend/index";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

/**
 * 公開ノート API が認証ガードより前にマウントされ、応答して短絡することで
 * `/api/*` の requireSession を通さないことを、実アプリの合成で検証する。
 * 同時に既存の認証必須 API (`/api/me`) が保護されたままであることも確認する。
 */
describe("notes public routing", () => {
  function env(): Env {
    return { D1: createTestD1(), KV: {} } as unknown as Env;
  }

  it("serves GET /api/v1/notes without a session (public)", async () => {
    const res = await app.request("/api/v1/notes", {}, env());
    expect(res.status).toBe(200);
  });

  it("still protects GET /api/me behind the session guard", async () => {
    const res = await app.request("/api/me", {}, env());
    expect(res.status).toBe(401);
  });
});
