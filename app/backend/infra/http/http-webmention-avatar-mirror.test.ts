import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpWebmentionAvatarMirror } from "./http-webmention-avatar-mirror";
import { emptyStream } from "./test-helper";
import type { ILogger } from "~/backend/domain/shared";
import type { IWebmentionAvatarCache } from "~/backend/domain/webmention";
import { WebmentionUrl } from "~/backend/domain/webmention";

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

/** 写した顔を控えるだけの受け皿。 */
function recordingCache(): IWebmentionAvatarCache & {
  readonly puts: { id: string; bytes: Uint8Array; contentType: string }[];
} {
  const puts: { id: string; bytes: Uint8Array; contentType: string }[] = [];
  return {
    puts,
    put: (id, asset) => {
      puts.push({ id, bytes: asset.bytes, contentType: asset.contentType });
      return Promise.resolve();
    },
    get: () => Promise.resolve(undefined),
  };
}

const photo = WebmentionUrl.create("https://example.com/face.png");

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("HttpWebmentionAvatarMirror", () => {
  it("画像を写して id を返す", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/png" },
      }),
    );
    const cache = recordingCache();

    const id = await new HttpWebmentionAvatarMirror(cache, silentLogger()).mirror(photo);

    expect(id).toBeDefined();
    expect(cache.puts).toHaveLength(1);
    // 中身と型まで見る。数だけだと 0 バイトを書いても通ってしまう。
    expect(cache.puts[0].bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(cache.puts[0].contentType).toBe("image/png");
  });

  /*
   * 中身の無い 200 を写さない。写すと、届いた反応の顔の欄に 0 バイトの絵が並ぶ (#293)。
   */
  it("中身の無い応答は写さない", async () => {
    fetchMock.mockResolvedValue(
      new Response(emptyStream(), { headers: { "content-type": "image/png" } }),
    );
    const cache = recordingCache();
    const logger = silentLogger();

    const id = await new HttpWebmentionAvatarMirror(cache, logger).mirror(photo);

    expect(id).toBeUndefined();
    expect(cache.puts).toEqual([]);
    // 無音だと「顔を持たない送り手」と見分けが付かず、直すきっかけが無い (#255)。
    expect(logger.info).toHaveBeenCalledWith(
      "webmention avatar was empty",
      expect.objectContaining({ photo: photo.toString() }),
    );
  });

  it("画像でない型は写さない", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>", { headers: { "content-type": "text/html" } }),
    );
    const cache = recordingCache();

    await expect(
      new HttpWebmentionAvatarMirror(cache, silentLogger()).mirror(photo),
    ).resolves.toBeUndefined();
    expect(cache.puts).toEqual([]);
  });

  /* 相手が落ちているのは異常ではない。顔の無い mention として通す。 */
  it("取りに行けなくても throw しない", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const cache = recordingCache();

    await expect(
      new HttpWebmentionAvatarMirror(cache, silentLogger()).mirror(photo),
    ).resolves.toBeUndefined();
  });
});
