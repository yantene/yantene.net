import { describe, expect, it } from "vitest";
import { createRefreshRouter } from "./refresh.handler";

function post(
  headers: Record<string, string>,
  env: Env,
): Response | Promise<Response> {
  return createRefreshRouter().request(
    "/refresh",
    { method: "POST", headers },
    env,
  );
}

describe("createRefreshRouter POST /refresh", () => {
  it("fails loud (500) when REFRESH_SECRET is not configured", async () => {
    const res = await post(
      { "X-Refresh-Token": "anything" },
      {} as unknown as Env,
    );
    expect(res.status).toBe(500);
  });

  it("rejects (401) when the token header is missing", async () => {
    const res = await post({}, { REFRESH_SECRET: "s3cr3t" } as unknown as Env);
    expect(res.status).toBe(401);
  });

  it("rejects (401) when the token does not match", async () => {
    const res = await post({ "X-Refresh-Token": "wrong" }, {
      REFRESH_SECRET: "s3cr3t",
    } as unknown as Env);
    expect(res.status).toBe(401);
  });
});
