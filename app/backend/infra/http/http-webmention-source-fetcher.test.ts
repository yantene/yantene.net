/*
 * @vitest-environment node
 *
 * 応答の本文をストリームとして少しずつ読む (サイズ上限のため)。happy-dom の Response は
 * body の扱いが素の実装と異なるので、ここは node で走らせる。
 */
import { describe, expect, it, vi } from "vitest";
import { HttpWebmentionSourceFetcher } from "./http-webmention-source-fetcher";
import type { ILogger } from "~/backend/domain/shared";
import { WebmentionUrl } from "~/backend/domain/webmention";

const SOURCE = WebmentionUrl.create("https://example.com/post/1");

/** ログは検証の対象ではないので捨てる。 */
function silentLogger(): ILogger {
  const logger: ILogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => logger,
  };
  return logger;
}

function htmlResponse(
  body: string,
  init: { status?: number; contentType?: string } = {},
): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "content-type": init.contentType ?? "text/html; charset=utf-8" },
  });
}

function fetcherFor(
  response: Response | Error,
  options: { maxBytes?: number } = {},
): HttpWebmentionSourceFetcher {
  return new HttpWebmentionSourceFetcher(silentLogger(), {
    ...options,
    fetchFn: () =>
      response instanceof Error
        ? Promise.reject(response)
        : Promise.resolve(response),
  });
}

describe("HttpWebmentionSourceFetcher", () => {
  it("HTML を取れたら本文を返す", async () => {
    const result = await fetcherFor(htmlResponse("<p>hi</p>")).fetch(SOURCE);

    expect(result).toEqual({ kind: "fetched", url: SOURCE, html: "<p>hi</p>" });
  });

  it.each([404, 410])("送り元が消えていれば gone (%i)", async (status) => {
    const result = await fetcherFor(htmlResponse("", { status })).fetch(SOURCE);

    expect(result.kind).toBe("gone");
  });

  it.each([403, 500, 503])(
    "その他の失敗は unavailable (%i)",
    async (status) => {
      const result = await fetcherFor(htmlResponse("", { status })).fetch(
        SOURCE,
      );

      expect(result.kind).toBe("unavailable");
    },
  );

  it("HTML でなければ unavailable", async () => {
    const result = await fetcherFor(
      htmlResponse("{}", { contentType: "application/json" }),
    ).fetch(SOURCE);

    expect(result).toEqual({ kind: "unavailable", reason: "not html" });
  });

  /*
   * 途中まで読んだ HTML は検証に使わない。切れた位置より後ろにリンクがあっただけの
   * 相手を「リンクしていない」と誤判定してしまう。
   */
  it("大きすぎる本文は読み切らずに諦める", async () => {
    const result = await fetcherFor(htmlResponse("x".repeat(100)), {
      maxBytes: 10,
    }).fetch(SOURCE);

    expect(result).toEqual({ kind: "unavailable", reason: "body too large" });
  });

  /*
   * 相手が落ちているのは異常ではない。fail-loud にせず、保存を見送るだけにする。
   */
  it("取りに行けなければ throw せず unavailable を返す", async () => {
    const result = await fetcherFor(new Error("network down")).fetch(SOURCE);

    expect(result).toEqual({ kind: "unavailable", reason: "fetch failed" });
  });

  it("タイムアウトの signal を付け、転送を追って取りに行く", async () => {
    const fetchFn = vi.fn(
      (
        _input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1],
      ) => Promise.resolve(htmlResponse("<p>hi</p>")),
    );
    const fetcher = new HttpWebmentionSourceFetcher(silentLogger(), {
      fetchFn: fetchFn as unknown as typeof fetch,
      timeoutMs: 1234,
    });

    await fetcher.fetch(SOURCE);

    const init = fetchFn.mock.calls[0][1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.redirect).toBe("follow");
  });

  /* 転送先の相対リンクを解決する基準になるので、最終 URL を返す。 */
  it("転送を追い切ったあとの URL を返す", async () => {
    const redirected = new Response("<p>hi</p>", {
      headers: { "content-type": "text/html" },
    });
    Object.defineProperty(redirected, "url", {
      value: "https://example.com/post/1/final",
    });

    const result = await fetcherFor(redirected).fetch(SOURCE);

    expect(result.kind === "fetched" && result.url.toString()).toBe(
      "https://example.com/post/1/final",
    );
  });
});
