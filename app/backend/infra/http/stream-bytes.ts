/**
 * 外から流れてくるバイト列を読むときの、共通の細工。
 *
 * 上限まで読む {@link readCapped} と、head を読み終えた時点で打ち切る
 * {@link readUntilHead} が同じ後始末を必要とする。片方だけ後始末が変わると、
 * そちらだけが結論を通信の失敗に化けさせるので 1 か所に置く。
 */

/**
 * 読むのをやめたことを相手に伝える。伝えられなくても結論は変えない。
 *
 * `cancel()` は既に壊れているストリームでは、そのストリームが抱えた失敗で拒否される。
 * 素通しにすると「大きすぎた」という**こちらが下した結論**が、通信の失敗に化けて
 * 呼び出し側へ届く (送り元フェッチャなら "body too large" が "fetch failed" になる)。
 */
export async function stopReading(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // 打ち切りを伝えられなかっただけで、読むのをやめた事実は変わらない。
  }
}

/** 集めた塊を 1 本に繋ぐ。 */
export function concat(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

/**
 * 上限が数として読めなければ止める。
 *
 * `total > NaN` は常に偽なので、黙って通すと**枷が外れたことに誰も気づかないまま
 * 際限なく読む**ことになる (fail-loud)。
 */
export function assertMaxBytes(maxBytes: number): void {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new RangeError(`maxBytes must be a positive number: ${String(maxBytes)}`);
  }
}
