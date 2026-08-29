/*
 * @vitest-environment node
 *
 * 応答の本文をストリームとして読む。happy-dom の Response は body の扱いが素の実装と
 * 異なるので、ここは node で走らせる (read-capped.test.ts と同じ理由)。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCapped } from "./fetch-capped";

const utf8 = new TextEncoder();
const options = { accept: "text/html", maxBytes: 1024 };

/** その応答を返すだけの fetch を差し込む。 */
function stubFetch(response: Response | Error): void {
  vi.stubGlobal("fetch", () =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCapped", () => {
  it("取れた本文をバイト列と Content-Type で返す", async () => {
    stubFetch(
      new Response("<p>hi</p>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );

    const page = await fetchCapped("https://example.com/", options);

    expect(page?.bytes).toEqual(utf8.encode("<p>hi</p>"));
    expect(page?.contentType).toBe("text/html; charset=utf-8");
  });

  it("失敗した応答は undefined", async () => {
    stubFetch(new Response("", { status: 500 }));

    await expect(fetchCapped("https://example.com/", options)).resolves.toBeUndefined();
  });

  /*
   * 本文の無い応答 (204 や HEAD への返事) は読みようがない。`getReader()` に渡す前に
   * ここで断つ。
   */
  it("本文の無い応答は undefined", async () => {
    stubFetch(new Response(null, { status: 200 }));

    await expect(fetchCapped("https://example.com/", options)).resolves.toBeUndefined();
  });

  /*
   * 上限を超えたものは、途中まででも返さない。中途半端な HTML から中途半端な
   * カードを組んでしまうため。
   */
  it("上限を超える本文は undefined", async () => {
    stubFetch(new Response("x".repeat(100)));

    const page = await fetchCapped("https://example.com/", {
      ...options,
      maxBytes: 10,
    });

    expect(page).toBeUndefined();
  });

  /* 相対 URL の解決基準になるので、転送を追い切った後の URL を返す。 */
  it("転送後の URL を返す", async () => {
    const response = new Response("<p>hi</p>");
    Object.defineProperty(response, "url", {
      value: "https://example.com/final",
    });
    stubFetch(response);

    const page = await fetchCapped("https://example.com/", options);

    expect(page?.url).toBe("https://example.com/final");
  });

  /* 差し替えた Response は url が空になる。頼んだ URL に戻す。 */
  it("転送後の URL が読めなければ、頼んだ URL を返す", async () => {
    stubFetch(new Response("<p>hi</p>"));

    const page = await fetchCapped("https://example.com/asked", options);

    expect(page?.url).toBe("https://example.com/asked");
  });
});
