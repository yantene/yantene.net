/*
 * @vitest-environment node
 *
 * ReadableStream を細かく刻んで読ませる。happy-dom のストリームは素の実装と挙動が
 * 違うので、ここは node で走らせる (http-webmention-source-fetcher.test.ts と同じ理由)。
 */
import { describe, expect, it, vi } from "vitest";
import { readCapped } from "./read-capped";

const utf8 = new TextEncoder();

/** 与えた塊を順に流すストリーム。上限の判定は塊の切れ目で起きる。 */
function streamOf(
  ...chunks: readonly Uint8Array[]
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe("readCapped", () => {
  it("上限に収まる本文を 1 本に繋いで返す", async () => {
    const bytes = await readCapped(
      streamOf(utf8.encode("あい"), utf8.encode("うえお")),
      1024,
    );

    expect(bytes).toEqual(utf8.encode("あいうえお"));
  });

  it("空の本文は空のバイト列になる", async () => {
    await expect(readCapped(streamOf(), 1024)).resolves.toEqual(
      new Uint8Array(0),
    );
  });

  /*
   * 途中まで読んだものは返さない。切れた HTML を後段に渡すと、リンクが切れ目より
   * 後ろにあっただけの相手を「リンクしていない」と誤判定する。
   */
  it("上限を超えたら undefined を返す", async () => {
    const bytes = await readCapped(streamOf(new Uint8Array(100)), 10);

    expect(bytes).toBeUndefined();
  });

  it("ちょうど上限までは読み切る", async () => {
    // 「超えたら」なので、等しいところで諦めない。
    const bytes = await readCapped(streamOf(new Uint8Array(10)), 10);

    expect(bytes).toEqual(new Uint8Array(10));
  });

  it("塊をまたいで数える", async () => {
    // 1 塊ずつは上限に収まるが、合わせると超える。
    const bytes = await readCapped(
      streamOf(new Uint8Array(6), new Uint8Array(6)),
      10,
    );

    expect(bytes).toBeUndefined();
  });

  /*
   * 諦めるときは、そこで読むのをやめて相手に伝える。
   *
   * **求められたときだけ塊を渡す相手を使う。** 先に全部積んだストリームだと、
   * 「最後まで読んでから cancel する」実装でもこのテストは通ってしまい、
   * 早く止まっていることを確かめたことにならない。
   */
  it("上限を超えたらそこで読むのをやめ、cancel する", async () => {
    const cancel = vi.fn();
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(6));
      },
      cancel,
    });

    const bytes = await readCapped(stream, 10);

    expect(bytes).toBeUndefined();
    expect(cancel).toHaveBeenCalledTimes(1);
    /*
     * 6 バイトずつなので 2 つめで超える。ストリームは求められる前に 1 つ先を
     * 用意しておく作りなので、超えた時点での回数は 3 を超えない。際限なく
     * 引き続けていればここが伸びる。
     */
    expect(pulls).toBeLessThanOrEqual(3);
  });

  it("読み切るときは cancel しない", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4));
        controller.close();
      },
      cancel,
    });

    await readCapped(stream, 10);

    expect(cancel).not.toHaveBeenCalled();
  });

  /*
   * 打ち切りを伝えられなくても、こちらの結論は変わらない。cancel の拒否を
   * 素通しすると「大きすぎた」が通信の失敗に化けて呼び出し側へ届く。
   */
  it("cancel が拒否されても、大きすぎたという結果を返す", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(100));
      },
      cancel: () => Promise.reject(new Error("connection reset")),
    });

    await expect(readCapped(stream, 10)).resolves.toBeUndefined();
  });

  /*
   * 上限が数として読めないときは黙って通さない。`total > NaN` は常に偽なので、
   * 通すと枷が外れたことに誰も気づかないまま際限なく読むことになる。
   */
  it.each([NaN, 0, -1, Infinity])(
    "読めない上限 (%s) は投げて知らせる",
    async (maxBytes) => {
      await expect(readCapped(streamOf(), maxBytes)).rejects.toThrow(
        RangeError,
      );
    },
  );
});
