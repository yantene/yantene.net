import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { getApp } from "~/backend";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
import { notFoundResponse } from "~/lib/problem-details";

function env(): Env {
  return { D1: createTestD1(), R2: createTestR2().bucket } as unknown as Env;
}

/**
 * ページ委譲は c.executionCtx を読む。app.request に渡さないとそこで throw し、
 * 委譲まで届く前に 500 になる (委譲の有無を見たいので、ここは本物と同じ形にする)。
 */
function executionCtx(): ExecutionContext {
  return {
    waitUntil: () => {
      /* 何もしない */
    },
    passThroughOnException: () => {
      /* 何もしない */
    },
  } as unknown as ExecutionContext;
}

/** ページ委譲が呼ばれたことが分かるアプリ。 */
function appWithMarkedDelegate(): ReturnType<typeof getApp> {
  return getApp(() =>
    Promise.resolve(
      new Response("delegated", {
        status: 404,
        headers: { "X-Delegated": "1" },
      }),
    ),
  );
}

describe("路の見つからない要求", () => {
  /*
   * 末尾の app.all("*") がどのメソッド・どのパスにも応答するので、未マッチは
   * すべてページ委譲へ落ちる。**app.notFound を足してもここは変わらない** — 変わると
   * サイト全体の 404 が HTML のページから Problem Details に置き換わってしまう (#290)。
   */
  it.each([
    ["/nope", "GET"],
    ["/api/v1/nope", "GET"],
    ["/og/nope", "GET"],
    ["/notes/x", "PATCH"],
  ])("%s (%s) はページ委譲へ落ちる", async (path, method) => {
    const res = await appWithMarkedDelegate().request(path, { method }, env(), executionCtx());

    expect(res.headers.get("X-Delegated")).toBe("1");
  });
});

/*
 * c.notFound() を呼んだときの形。
 *
 * ⚠️ **合成済みのアプリからは発火させられない。** 全パス × 全メソッド (独自メソッドを
 * 含む) を実際に叩いて確かめたが、app.all("*") がすべてを拾う。したがって index.ts の
 * `app.notFound` の登録そのものは、ここでは見張れていない (消しても全件通る)。
 *
 * 見張れるのは**形だけ**で、同じハンドラを載せた小さなアプリで固定する。ここが
 * text/plain に戻ると、次に c.notFound() を書いた人の応答だけ、サイトの他の 404 と
 * 形が違うことになる。
 */
describe("c.notFound() の応答", () => {
  it("Problem Details で返す", async () => {
    const app = new Hono();
    app.notFound(() => notFoundResponse());
    app.get("/probe", (c) => c.notFound());

    const res = await app.request("/probe");

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
    expect(await res.json()).toMatchObject({ status: 404 });
  });

  it("既定のままなら text/plain になる (置く理由)", async () => {
    const app = new Hono();
    app.get("/probe", (c) => c.notFound());

    const res = await app.request("/probe");

    expect(res.headers.get("Content-Type")).not.toContain("problem+json");
  });
});
