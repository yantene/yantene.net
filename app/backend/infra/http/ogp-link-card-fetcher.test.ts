import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OgpLinkCardFetcher } from "./ogp-link-card-fetcher";
import type { ILogger } from "~/backend/domain/shared";
import { LinkCardUrl } from "~/backend/domain/link-card";

function silentLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

/** 最終 URL (リダイレクト後) を持つ応答を組み立てる。Response.url は読み取り専用なので上書きする。 */
function respond(
  body: BodyInit,
  init: { contentType: string; status?: number; url?: string },
): Response {
  const response = new Response(body, {
    status: init.status ?? 200,
    headers: { "content-type": init.contentType },
  });
  if (init.url !== undefined) {
    Object.defineProperty(response, "url", { value: init.url });
  }
  return response;
}

const page = `
  <html><head>
    <meta property="og:title" content="記事の題">
    <meta property="og:description" content="説明">
    <meta property="og:site_name" content="サイト名">
    <meta property="og:image" content="/og.png">
    <link rel="icon" href="/icon.png">
  </head></html>
`;

const pngBytes = new Uint8Array([137, 80, 78, 71]);

/** fetch の差し替え。Promise を返すことを型に持たせないと、渡す実装が void 扱いになる。 */
type FetchStub = (url: string) => Promise<Response>;

describe("OgpLinkCardFetcher", () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchStub>>;

  beforeEach(() => {
    fetchMock = vi.fn<FetchStub>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("OGP と画像・favicon を読む", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://example.com/a") {
        return Promise.resolve(
          respond(page, {
            contentType: "text/html; charset=utf-8",
            url: "https://example.com/a",
          }),
        );
      }
      return Promise.resolve(
        respond(pngBytes, { contentType: "image/png", url }),
      );
    });

    const fetched = await new OgpLinkCardFetcher(silentLogger()).fetch(
      LinkCardUrl.create("https://example.com/a"),
    );

    expect(fetched?.title).toBe("記事の題");
    expect(fetched?.description).toBe("説明");
    expect(fetched?.siteName).toBe("サイト名");
    expect(fetched?.image).toMatchObject({
      state: "stored",
      asset: { contentType: "image/png" },
    });
    expect(fetched?.favicon?.contentType).toBe("image/png");
    // og:image の相対パスは最終 URL を基準に解決する。
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/og.png",
      expect.anything(),
    );
  });

  it("リダイレクト後の URL を基準に相対 URL を解決する", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://example.com/a") {
        return Promise.resolve(
          respond(page, {
            contentType: "text/html",
            url: "https://moved.example.net/b/c",
          }),
        );
      }
      return Promise.resolve(
        respond(pngBytes, { contentType: "image/png", url }),
      );
    });

    await new OgpLinkCardFetcher(silentLogger()).fetch(
      LinkCardUrl.create("https://example.com/a"),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://moved.example.net/og.png",
      expect.anything(),
    );
  });

  it("rel=icon が無ければ慣例の /favicon.ico を試す", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://example.com/a") {
        return Promise.resolve(
          respond(`<title>題</title>`, {
            contentType: "text/html",
            url: "https://example.com/a",
          }),
        );
      }
      return Promise.resolve(
        respond(pngBytes, { contentType: "image/x-icon", url }),
      );
    });

    const fetched = await new OgpLinkCardFetcher(silentLogger()).fetch(
      LinkCardUrl.create("https://example.com/a"),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/favicon.ico",
      expect.anything(),
    );
    expect(fetched?.favicon?.contentType).toBe("image/x-icon");
  });

  it("HTML でなければカードにしない", async () => {
    fetchMock.mockResolvedValue(
      respond("{}", { contentType: "application/json" }),
    );

    const fetched = await new OgpLinkCardFetcher(silentLogger()).fetch(
      LinkCardUrl.create("https://example.com/a"),
    );

    expect(fetched).toBeUndefined();
  });

  it("題が無いページはカードにしない", async () => {
    fetchMock.mockResolvedValue(
      respond("<html><body>本文だけ</body></html>", {
        contentType: "text/html",
      }),
    );

    const fetched = await new OgpLinkCardFetcher(silentLogger()).fetch(
      LinkCardUrl.create("https://example.com/a"),
    );

    expect(fetched).toBeUndefined();
  });

  it("応答が失敗ならカードにしない", async () => {
    fetchMock.mockResolvedValue(
      respond("not found", { contentType: "text/html", status: 404 }),
    );

    const fetched = await new OgpLinkCardFetcher(silentLogger()).fetch(
      LinkCardUrl.create("https://example.com/a"),
    );

    expect(fetched).toBeUndefined();
  });

  it("大きすぎる HTML は読まない", async () => {
    fetchMock.mockResolvedValue(
      respond("x".repeat(600 * 1024), { contentType: "text/html" }),
    );

    const fetched = await new OgpLinkCardFetcher(silentLogger()).fetch(
      LinkCardUrl.create("https://example.com/a"),
    );

    expect(fetched).toBeUndefined();
  });

  it("SVG の画像は写さない (カード自体は作る)", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://example.com/a") {
        return Promise.resolve(
          respond(page, {
            contentType: "text/html",
            url: "https://example.com/a",
          }),
        );
      }
      return Promise.resolve(
        respond("<svg/>", { contentType: "image/svg+xml", url }),
      );
    });

    const fetched = await new OgpLinkCardFetcher(silentLogger()).fetch(
      LinkCardUrl.create("https://example.com/a"),
    );

    expect(fetched?.title).toBe("記事の題");
    // 載せられない型は取り直しても結論が変わらないので、取り逃しには数えない。
    expect(fetched?.image).toEqual({ state: "absent" });
    expect(fetched?.favicon).toBeUndefined();
  });

  it("og:image が書かれていなければ取り逃しではない", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://example.com/a") {
        return Promise.resolve(
          respond(`<title>題</title>`, {
            contentType: "text/html",
            url: "https://example.com/a",
          }),
        );
      }
      return Promise.reject(new Error("no favicon"));
    });

    const fetched = await new OgpLinkCardFetcher(silentLogger()).fetch(
      LinkCardUrl.create("https://example.com/a"),
    );

    expect(fetched?.image).toEqual({ state: "absent" });
  });

  it("画像だけ取れなくてもカードは作り、取り逃しとして残す", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://example.com/a") {
        return Promise.resolve(
          respond(page, {
            contentType: "text/html",
            url: "https://example.com/a",
          }),
        );
      }
      return Promise.reject(new Error("network down"));
    });
    const logger = silentLogger();

    const fetched = await new OgpLinkCardFetcher(logger).fetch(
      LinkCardUrl.create("https://example.com/a"),
    );

    expect(fetched?.title).toBe("記事の題");
    expect(fetched?.image).toEqual({ state: "missed" });
    expect(logger.info).toHaveBeenCalledWith(
      "link card image not mirrored",
      expect.objectContaining({ imageUrl: "https://example.com/og.png" }),
    );
  });

  it("画像がレート制限で返らなくても取り逃しとして残す", async () => {
    // 本番で踏んだのはこれ。応答は返るが 429 なので、写しだけ作れない (#255)。
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://example.com/a") {
        return Promise.resolve(
          respond(page, {
            contentType: "text/html",
            url: "https://example.com/a",
          }),
        );
      }
      return Promise.resolve(
        respond("rate limited", {
          contentType: "text/plain",
          status: 429,
          url,
        }),
      );
    });

    const fetched = await new OgpLinkCardFetcher(silentLogger()).fetch(
      LinkCardUrl.create("https://example.com/a"),
    );

    expect(fetched?.title).toBe("記事の題");
    expect(fetched?.image).toEqual({ state: "missed" });
    // favicon の取り逃しは数えない (置いていない相手が毎回引っ掛かるため)。
    expect(fetched?.favicon).toBeUndefined();
  });

  it("取りに行けなければ throw せず undefined を返し、記録を残す", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const logger = silentLogger();

    const fetched = await new OgpLinkCardFetcher(logger).fetch(
      LinkCardUrl.create("https://example.com/a"),
    );

    expect(fetched).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      "link card fetch failed",
      expect.objectContaining({ url: "https://example.com/a" }),
    );
  });
});
