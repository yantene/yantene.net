import { useRef, useState } from "react";

/** コードブロック (pre) 差し替え: 右上にコピーボタンを添える。 */
export function CodeBlock(
  props: Readonly<React.ComponentPropsWithoutRef<"pre">>,
): React.JSX.Element {
  const ref = useRef<HTMLPreElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  async function copy(): Promise<void> {
    const text = ref.current?.textContent ?? "";
    try {
      await globalThis.navigator.clipboard.writeText(text);
      setIsCopied(true);
      globalThis.setTimeout(() => setIsCopied(false), 1500);
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
