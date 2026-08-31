/**
 * 外から流れてくる HTML を、`</head>` を読み終えた時点で打ち切って読む。
 *
 * OGP を探すためだけの経路。相手のページは本文が数 MB あることがあるが、こちらが
 * 見たい題・説明・絵・favicon はどれも head にある。上限まで読んでから諦めると、
 * 先頭 12 KB に材料が揃っているページを 1.19 MB 読もうとして上限に当たり、**カードに
 * ならない** (ユニクロの商品ページで踏んだ)。上限を上げても次に大きいページが来れば
 * 同じことなので、読む量のほうを減らす。
 *
 * 共有の {@link readCapped} は触らない。あちらは Webmention の送り元 HTML も使い、
 * 途中で切るとリンクが切れ目より後ろにあっただけの相手を「リンクしていない」と
 * 誤判定する。
 */
import { assertMaxBytes, concat, stopReading } from "./stream-bytes";

/** `</head` に続く空白 (HTML の空白文字)。閉じタグは `</head >` とも書ける。 */
const spaces: ReadonlySet<number> = new Set([0x09, 0x0a, 0x0c, 0x0d, 0x20]);

/** 探す綴り。大文字小文字は区別しないので、小文字に倒して比べる。 */
const headEndTag = new TextEncoder().encode("</head");

const lessThan = "<".charCodeAt(0);
const greaterThan = ">".charCodeAt(0);

/** ASCII の大文字だけ小文字に倒す。多バイト文字の途中を触らないため。 */
function toLowerByte(byte: number): number {
  return byte >= 0x41 && byte <= 0x5a ? byte + 0x20 : byte;
}

/**
 * 流れてくる塊から `</head>` の終わりを探す。
 *
 * **合った途中の状態を塊をまたいで持ち越す。** 塊の切れ目は相手が決めるので、
 * `</hea` と `d>` に分かれて届くことがある。塊ごとに探し直すと、そこだけ見落とす。
 */
function createHeadEndScanner(): (chunk: Uint8Array) => number | undefined {
  // どこまで合ったか。綴りの長さまで来たら、あとは空白を読み飛ばして `>` を待つ。
  let matched = 0;

  return function scan(chunk: Uint8Array): number | undefined {
    // 添字で回す。`entries()` は 1 バイトごとに 2 要素の配列を作るので、`</head>` を
    // 持たないページで上限まで走らせたときに 18 倍ほど遅くなる。
    for (let index = 0; index < chunk.length; index += 1) {
      const byte = chunk[index];
      if (matched === headEndTag.length) {
        if (byte === greaterThan) return index + 1;
        if (spaces.has(byte)) continue;
        // 綴りは合っていたが閉じなかった (`</heads` など)。ここから読み直す。
        matched = byte === lessThan ? 1 : 0;
        continue;
      }

      if (toLowerByte(byte) === headEndTag[matched]) {
        matched += 1;
        continue;
      }
      // 外れた分は捨てるが、この 1 バイトが次の `<` かもしれない (`<</head>`)。
      matched = byte === lessThan ? 1 : 0;
    }
    return undefined;
  };
}

/**
 * `</head>` までを読んで返す。**そこまで読めれば「読み切れた」ものとして扱う。**
 *
 * head が閉じている以上、OGP の meta も `rel=icon` も `<meta charset>` も揃っている。
 * {@link readCapped} が避けたい「途中で切れた meta から中途半端なカードを組む」状態
 * には落ちない。
 *
 * `</head>` を持たないページ (省略しても HTML としては妥当) では、いままでどおり
 * 上限まで読み、超えたら undefined を返す。`</head>` が上限より後ろにあるときも同じ。
 *
 * 探すのはバイトの並びだけで、HTML として構文解析はしない。head の中の script や
 * コメントに `</head>` の 7 文字が現れれば、そこで切る。切った後ろに og の meta が
 * あればそれは読めなくなるが、拾えた分でカードは組める (題が無ければ素のリンク)。
 * OGP を読むのに正しい構文解析器を持ち込む価値は無いと見て、素朴なほうを採る。
 */
export async function readUntilHead(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array | undefined> {
  assertMaxBytes(maxBytes);

  const reader = body.getReader();
  const scan = createHeadEndScanner();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done: isDone, value } = await reader.read();
    if (isDone) break;

    /*
     * 上限より先に head の終わりを見る。塊が丸ごと大きいときでも、その中の
     * `</head>` が上限までに現れていれば読み切れたことにする。
     */
    const headEnd = scan(value);
    if (headEnd !== undefined) {
      const untilHead = total + headEnd;
      await stopReading(reader);
      if (untilHead > maxBytes) return undefined;
      return concat([...chunks, value.subarray(0, headEnd)], untilHead);
    }

    total += value.byteLength;
    if (total > maxBytes) {
      await stopReading(reader);
      return undefined;
    }
    chunks.push(value);
  }

  return concat(chunks, total);
}
