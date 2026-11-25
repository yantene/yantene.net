import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/** 押した結果を出しておく時間。 */
const FEEDBACK_MS = 1500;

/**
 * いま出している結果。null は表示が「コピー」に戻っている状態。
 *
 * 押すたびに**新しいオブジェクト**を作る。同じ結果が続いても値が変わったことになるので、
 * 下の effect が回って表示の時間を測り直す。結果の文字列だけを state に持つと、2 回目に
 * 押しても値が "copied" から動かず、1 回目の予定がそのまま残る。1 回目の予定が発火した
 * 時点で表示が戻るため、2 回目のコピーは成功しているのに失敗したように見えていた (#305)。
 */
interface Feedback {
  readonly outcome: "copied" | "failed";
}

/*
 * 翻訳のキーは組み立てず、そのまま書く。`codeBlock.${outcome}` のように綴ると、キーを
 * grep しても見つからない場所ができる (share-menu.tsx と同じ)。
 */
function feedbackText(feedback: Feedback | null, t: (key: string) => string): string | undefined {
  if (feedback === null) return undefined;
  if (feedback.outcome === "copied") return t("codeBlock.copied");
  return t("codeBlock.copyFailed");
}

/** コードブロック (pre) 差し替え: 右上にコピーボタンを添える。 */
export function CodeBlock(
  props: Readonly<React.ComponentPropsWithoutRef<"pre">>,
): React.JSX.Element {
  const { t } = useTranslation();
  const ref = useRef<HTMLPreElement>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  /*
   * 表示を戻す予定は effect が持つ。押すたびに片付けて張り直し、外れるときも片付ける。
   *
   * 予定を置きっぱなしにしていた頃は、記事を移った後に外れたコンポーネントの状態を
   * 触りに行く予定が残っていた。
   */
  useEffect(() => {
    if (feedback === null) return;
    const timer = globalThis.setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [feedback]);

  async function copy(): Promise<void> {
    const text = ref.current?.textContent ?? "";
    try {
      await globalThis.navigator.clipboard.writeText(text);
      setFeedback({ outcome: "copied" });
    } catch {
      /*
       * クリップボード API が使えない環境 (非セキュアコンテキスト、権限が下りない等)。
       * 黙っていると「押したのに何も起きない」になるので、失敗したことは出す。
       */
      setFeedback({ outcome: "failed" });
    }
  }

  const message = feedbackText(feedback, t);

  return (
    <div className="code-block">
      {/*
        名前は見える字のまま。aria-label で上書きすると、見える字と読み上げる名前が
        食い違い、結果に切り替わった字も読み上げに届かない。
      */}
      <button type="button" className="code-copy press-control" onClick={() => void copy()}>
        {message ?? t("codeBlock.copy")}
      </button>
      {/*
        結果は読み上げにも届ける。焦点の当たったボタンの名前が変わっても、読み上げは
        それを伝えないことが多いため。入れ物は畳まず置いたままにしておくこと (現れる作りに
        すると、読み上げが落ちる読み手がいる)。見える字はボタンのほうにあるので、こちらは
        画面から隠す。
      */}
      <span className="sr-only" role="status">
        {message}
      </span>
      <pre ref={ref} {...props} />
    </div>
  );
}
