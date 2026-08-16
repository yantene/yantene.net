/**
 * infra/http のテストで使う道具。
 */

/**
 * 中身が 1 バイトも流れてこない本文。
 *
 * `new Response("")` では模せない。**環境によって body が null になり** (happy-dom が
 * そう)、その場合は本文を読む手前で「本文が無い」として弾かれ、空を受け取ったときの
 * 判定を通らない。本物の Workers は `Content-Length: 0` の応答でも空のストリームを
 * 渡してくるので、そちらに合わせる (#293)。
 */
export function emptyStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
}
