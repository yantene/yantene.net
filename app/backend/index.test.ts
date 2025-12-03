import { describe, it, expect } from "vitest";
import { getApp } from "./index";

describe("getApp", () => {
  const mockEnv = {} as Env;
  const mockCtx = {} as ExecutionContext;

  it("/hello エンドポイントにレスポンスを返すこと", async () => {
    const mockHandler = async () => new Response("mock response");
    const app = getApp(mockHandler);

    const req = new Request("http://localhost/hello");
    const res = await app.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello, World!");
  });

  it("その他のリクエストをハンドラーに渡すこと", async () => {
    const mockHandler = async (request: Request) => {
      return new Response(`handler received: ${request.url}`);
    };
    const app = getApp(mockHandler);

    const req = new Request("http://localhost/some-other-path");
    const res = await app.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(
      "handler received: http://localhost/some-other-path",
    );
  });

  it("env と context をハンドラーに渡すこと", async () => {
    const mockHandler = async (
      _request: Request,
      env: Env,
      ctx: ExecutionContext,
    ) => {
      return new Response(
        JSON.stringify({
          hasEnv: !!env,
          hasCtx: !!ctx,
        }),
      );
    };
    const app = getApp(mockHandler);

    const req = new Request("http://localhost/test");
    const testEnv = {
      VALUE_FROM_CLOUDFLARE: "Hello from Cloudflare",
    } as Env;
    const testCtx = {} as ExecutionContext;

    const res = await app.fetch(req, testEnv, testCtx);
    const data = (await res.json()) as { hasEnv: boolean; hasCtx: boolean };

    expect(data.hasEnv).toBe(true);
    expect(data.hasCtx).toBe(true);
  });
});
