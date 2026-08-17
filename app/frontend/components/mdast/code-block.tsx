import { useEffect, useRef, useState } from "react";

/** 「コピーしました」を出しておく時間。 */
const COPIED_LABEL_MS = 1500;

/** コードブロック (pre) 差し替え: 右上にコピーボタンを添える。 */
export function CodeBlock(
  props: Readonly<React.ComponentPropsWithoutRef<"pre">>,
): React.JSX.Element {
  const ref = useRef<HTMLPreElement>(null);
  /*
   * コピーできた回数。0 は表示が「コピー」に戻っている状態。
   *
   * 真偽値ではなく数にしているのは、**押し直したことを状態の変化として出すため**。
   * 真偽値だと 2 回目に押しても値が true から動かず、下の effect が回らないので
   * 1 回目の予定がそのまま残る。1 回目の予定が発火した時点で表示が戻るため、
   * 2 回目のコピーは成功しているのに失敗したように見えていた (#305)。
   */
  const [copyCount, setCopyCount] = useState(0);
  const isCopied = copyCount > 0;

  /*
   * 表示を戻す予定は effect が持つ。押すたびに片付けて張り直し、外れるときも片付ける。
   *
   * 予定を置きっぱなしにしていた頃は、記事を移った後に外れたコンポーネントの状態を
   * 触りに行く予定が残っていた。
   */
  useEffect(() => {
    if (copyCount === 0) return;
    const timer = globalThis.setTimeout(() => setCopyCount(0), COPIED_LABEL_MS);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [copyCount]);

  async function copy(): Promise<void> {
    const text = ref.current?.textContent ?? "";
    try {
      await globalThis.navigator.clipboard.writeText(text);
      setCopyCount((count) => count + 1);
    } catch {
      // クリップボード API が使えない環境 (非セキュアコンテキスト等) では何もしない。
    }
  }

  return (
    <div className="code-block">
      <button
        type="button"
        className="code-copy press-control"
        onClick={() => void copy()}
        aria-label="コードをコピー"
      >
        {isCopied ? "コピーしました" : "コピー"}
      </button>
      <pre ref={ref} {...props} />
    </div>
  );
}
