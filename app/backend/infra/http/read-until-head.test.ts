/*
 * @vitest-environment node
 *
 * ReadableStream を細かく刻んで読ませる。happy-dom のストリームは素の実装と挙動が
 * 違うので、ここは node で走らせる (read-capped.test.ts と同じ理由)。
 */
import { describe, expect, it, vi } from "vitest";
import { readUntilHead } from "./read-until-head";

const utf8 = new TextEncoder();

/** 与えた塊を順に流すストリーム。head の照合は塊の切れ目をまたぐ。 */
function streamOf(...chunks: readonly (Uint8Array | string)[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === "string" ? utf8.encode(chunk) : chunk);
      }
      controller.close();
    },
  });
}

/** 読めたバイト列を文字列で見る。読めなければ undefined のまま返す。 */
async function readText(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<string | undefined> {
  const bytes = await readUntilHead(body, maxBytes);
  return bytes === undefined ? undefined : new TextDecoder().decode(bytes);
}

describe("readUntilHead", () => {
  it("</head> までを返し、その後ろは読まない", async () => {
    const text = await readText(
      streamOf("<html><head><title>題</title></head><body>本文</body></html>"),
      1024,
    );

    expect(text).toBe("<html><head><title>題</title></head>");
  });

  /*
   * 塊の切れ目は相手が決める。`</hea` と `d>` に分かれて届いても拾えないと、
   * 大きいページだけ気まぐれにカードにならなくなる。
   */
  it("</head> が塊をまたいでも拾う", async () => {
    const text = await readText(streamOf("<head><title>題</title></hea", "d><body>本文"), 1024);

    expect(text).toBe("<head><title>題</title></head>");
  });

  it("1 バイトずつ届いても拾う", async () => {
    const source = "<head><meta charset='utf-8'></head><body>本文";
    const text = await readText(
      streamOf(...[...utf8.encode(source)].map((b) => new Uint8Array([b]))),
      1024,
    );

    expect(text).toBe("<head><meta charset='utf-8'></head>");
  });

  it.each(["</HEAD>", "</Head>", "</head >", "</head\n\t>"])(
    "%s も head の終わりとして拾う",
    async (closing) => {
      const text = await readText(streamOf(`<head><title>題</title>${closing}<body>本文`), 1024);

      expect(text).toBe(`<head><title>題</title>${closing}`);
    },
  );

  /* 綴りが途中まで合っただけのものに引っ張られない。 */
  it("</heads> や </header> では打ち切らない", async () => {
    const text = await readText(streamOf("<div></heads></header></head>後ろ"), 1024);

    expect(text).toBe("<div></heads></header></head>");
  });

  /* `<</head>` のように、外れたバイトそのものが次の `<` であることがある。 */
  it("外れたバイトが次の < でも拾う", async () => {
    const text = await readText(streamOf("<<</head>後ろ"), 1024);

    expect(text).toBe("<<</head>");
  });

  /*
   * head を閉じたところで打ち切るので、そこまでが上限に収まっていれば全体が
   * 上限を超えていてもカードは作れる。読む量を減らすのがこの経路の目的。
   */
  it("全体が上限を超えていても、</head> までが収まっていれば読み切る", async () => {
    const text = await readText(streamOf(`<head></head>${"x".repeat(1000)}`), 100);

    expect(text).toBe("<head></head>");
  });

  it("</head> が上限より後ろにあれば undefined", async () => {
    const text = await readText(streamOf(`<head>${"x".repeat(1000)}</head>`), 100);

    expect(text).toBeUndefined();
  });

  /* head を持たないページ (省略しても HTML としては妥当) は、従来どおりの扱い。 */
  it("</head> が無く上限に収まるなら、全部を読み切る", async () => {
    const text = await readText(streamOf("<html><body>本文</body></html>"), 1024);

    expect(text).toBe("<html><body>本文</body></html>");
  });

  it("</head> が無く上限を超えたら undefined", async () => {
    const bytes = await readUntilHead(streamOf(new Uint8Array(100)), 10);

    expect(bytes).toBeUndefined();
  });

  it("空の本文は空のバイト列になる", async () => {
    await expect(readUntilHead(streamOf(), 1024)).resolves.toEqual(new Uint8Array(0));
  });

  /*
   * 求められたときだけ塊を渡す相手で、早く止まっていることを確かめる。先に全部
   * 積んだストリームだと、最後まで読んでから切る実装でもテストが通ってしまう。
   */
  it("</head> を読み終えたらそこで読むのをやめ、cancel する", async () => {
    const cancel = vi.fn();
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(utf8.encode(pulls === 1 ? "<head></head>" : "x".repeat(1024)));
      },
      cancel,
    });

    const bytes = await readUntilHead(stream, 512 * 1024);

    expect(new TextDecoder().decode(bytes)).toBe("<head></head>");
    expect(cancel).toHaveBeenCalledTimes(1);
    // 1 つ先を用意しておく作りなので、止まった時点での回数は 2 を超えない。
    expect(pulls).toBeLessThanOrEqual(2);
  });

  it("読み切るときは cancel しない", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(utf8.encode("<html><body>本文"));
        controller.close();
      },
      cancel,
    });

    await readUntilHead(stream, 1024);

    expect(cancel).not.toHaveBeenCalled();
  });

  /* 打ち切りを伝えられなくても、こちらの結論は変わらない。 */
  it("cancel が拒否されても、読めた分を返す", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(utf8.encode("<head></head>後ろ"));
      },
      cancel: () => Promise.reject(new Error("connection reset")),
    });

    await expect(readText(stream, 1024)).resolves.toBe("<head></head>");
  });

  it.each([NaN, 0, -1, Infinity])("読めない上限 (%s) は投げて知らせる", async (maxBytes) => {
    await expect(readUntilHead(streamOf(), maxBytes)).rejects.toThrow(RangeError);
  });
});
