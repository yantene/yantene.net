/**
 * 外から流れてくる本文を、上限まで読む。
 *
 * リンクカードの OGP と Webmention の送り元 HTML が、同じ枷を必要とする。片方だけ
 * 上限の扱いが変わると、そちらだけが際限なく読むようになるので 1 か所に置く
 * (charset.ts を 1 か所にしてあるのと同じ理由)。
 */

/**
 * 上限まで読んで 1 本のバイト列にする。**超えたら打ち切って undefined を返す。**
 *
 * 途中まで読んだものは返さない。切れた HTML を後段に渡すと、リンクが切れ目より後ろに
 * あっただけの相手を「リンクしていない」と誤判定したり、途中で切れた meta から
 * 中途半端なカードを組んだりする。読み切れたか、読めなかったかの 2 つだけにする。
 *
 * 数えるのは受け取り終えた塊の合計なので、**1 つの塊が丸ごと大きい場合、その塊は
 * 判定の前に手元に載る。** 塊の大きさは相手が決めるものでこちらからは選べない。
 * ここで抑えられるのは「受け入れる量」であって「一瞬の占有量」ではない。
 */
export async function readCapped(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array | undefined> {
  /*
   * 上限が数として読めなければ止める。`total > NaN` は常に偽なので、黙って通すと
   * **枷が外れたことに誰も気づかないまま際限なく読む**ことになる (fail-loud)。
   */
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new RangeError(
      `maxBytes must be a positive number: ${String(maxBytes)}`,
    );
  }

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

/**
 * 読むのをやめたことを相手に伝える。伝えられなくても結論は変えない。
 *
 * `cancel()` は既に壊れているストリームでは、そのストリームが抱えた失敗で拒否される。
 * 素通しにすると「大きすぎた」という**こちらが下した結論**が、通信の失敗に化けて
 * 呼び出し側へ届く (送り元フェッチャなら "body too large" が "fetch failed" になる)。
 */
async function stopReading(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // 打ち切りを伝えられなかっただけで、読むのをやめた事実は変わらない。
  }
}

/** 集めた塊を 1 本に繋ぐ。 */
function concat(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}
