/**
 * 外から流れてくる本文を、上限まで読む。
 *
 * リンクカードの OGP と Webmention の送り元 HTML が、同じ枷を必要とする。片方だけ
 * 上限の扱いが変わると、そちらだけが際限なく読むようになるので 1 か所に置く
 * (charset.ts を 1 か所にしてあるのと同じ理由)。
 */
import { assertMaxBytes, concat, stopReading } from "./stream-bytes";

/**
 * 上限まで読んで 1 本のバイト列にする。**超えたら打ち切って undefined を返す。**
 *
 * 途中まで読んだものは返さない。切れた HTML を後段に渡すと、リンクが切れ目より後ろに
 * あっただけの相手を「リンクしていない」と誤判定したり、途中で切れた meta から
 * 中途半端なカードを組んだりする。読み切れたか、読めなかったかの 2 つだけにする。
 *
 * **この契約は変えない。** 「先頭の一部で足りる」のは OGP を探すときだけなので、
 * そちらは {@link readUntilHead} という別の経路に置いてある。ここを打ち切りに変えると
 * Webmention の送り元 HTML まで途中で切れ、リンクの有無を誤判定する。
 *
 * 数えるのは受け取り終えた塊の合計なので、**1 つの塊が丸ごと大きい場合、その塊は
 * 判定の前に手元に載る。** 塊の大きさは相手が決めるものでこちらからは選べない。
 * ここで抑えられるのは「受け入れる量」であって「一瞬の占有量」ではない。
 */
export async function readCapped(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array | undefined> {
  assertMaxBytes(maxBytes);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done: isDone, value } = await reader.read();
    if (isDone) break;

    total += value.byteLength;
    if (total > maxBytes) {
      await stopReading(reader);
      return undefined;
    }
    chunks.push(value);
  }

  return concat(chunks, total);
}
