import { useEffect, useId, useRef, useState } from "react";
import { loadMermaid } from "./mermaid-loader.client";

/**
 * React の `useId()` の返り値を、Mermaid に渡せる識別子に均す。
 *
 * そのままでは渡せない。返り値には記号が入っており (React 19 は `«r0»`、18 までは `:r0:`)、
 * Mermaid はこの文字列を DOM の id にも、生成する CSS のセレクタにも使う。記号が残ると
 * `#«r0» .node` のような読めないセレクタになり、**例外は出ないまま図の配色だけが落ちる。**
 */
function toDiagramId(reactId: string): string {
  return `mermaid-${reactId.replaceAll(/[^\w-]/g, "")}`;
}

/**
 * 組み終わった結果。`svg` が null なら組めなかった (構文が読めない・本体を取り寄せられない)。
 *
 * ソースを一緒に持つのは、`source` が変わった瞬間に前のソースの図を出さないため。
 * 組み直しが始まるのは描画のあとの effect なので、その間の 1 描画が古い結果を持っている。
 */
interface Rendered {
  readonly source: string;
  readonly svg: string | null;
}

export interface MermaidDiagramProps {
  /** 図のソース。本文の ```mermaid フェンスの中身そのもの。 */
  readonly source?: string;
  /**
   * 組み上がるまでと、組めなかったときに出すもの。
   *
   * 渡ってくるのは元のコードブロックで、`mdast-renderer` がそれをこの要素で包む。
   * 失敗したときに出すべきものは「図にならなかっただけの普通のコードブロック」なので、
   * ここで組み直さず、包んだものをそのまま出す。
   */
  readonly children?: React.ReactNode;
}

/**
 * Mermaid のコードブロックを、ブラウザ上で SVG に組んで差し替える (ADR 0023)。
 *
 * サーバーでは元のコードブロックを描き、hydration のあとにクライアントで図へ差し替える。
 * 初回の描画はサーバーと同じものを返すので、hydration の食い違いは起きない。
 *
 * 本体を取り寄せるのは `useEffect` の中だけ。`loadMermaid` はサーバー側のビルドでは
 * `undefined` になる (mermaid-loader.client.ts)。
 */
export function MermaidDiagram({
  source,
  children,
}: MermaidDiagramProps): React.JSX.Element {
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const diagramId = toDiagramId(useId());
  const attempt = useRef(0);
  const hasSource = source !== undefined && source.trim() !== "";

  useEffect(() => {
    if (source === undefined || source.trim() === "") return;

    /*
     * 取り消しの合図。ソースが変わったときと、外されたときに倒す。先に始めた描画の
     * 結果が後から届いても、これを見て捨てる。
     */
    const abort = new AbortController();
    /*
     * 組むたびに別の id を使う。Mermaid は id を作業用の要素の名前にも使うので、
     * ソースが続けて変わって描画が重なったとき、同じ id だと後から始めた方が前の
     * 残骸を拾いうる。番号を足すだけで交わらなくなる。
     */
    attempt.current += 1;
    const renderId = `${diagramId}-${String(attempt.current)}`;

    void (async () => {
      try {
        const mermaid = await loadMermaid();
        const { svg } = await mermaid.render(renderId, source);
        if (!abort.signal.aborted) setRendered({ source, svg });
      } catch {
        // 構文が読めなかった場合も、Mermaid 自体を取り寄せられなかった場合も、
        // 落とし先は同じ (元のコードブロック)。図 1 つで記事を壊さない。
        if (!abort.signal.aborted) setRendered({ source, svg: null });
      }
    })();

    return () => {
      abort.abort();
    };
  }, [diagramId, source]);

  const isSettled = rendered !== null && rendered.source === source;

  if (isSettled && rendered.svg !== null) {
    return (
      /*
       * Mermaid が返すのは SVG の文字列なので、DOM に載せる道はここしかない。
       * 本文の sanitize (rehype-sanitize) を迂回する唯一の経路になるが、通すのは
       * 本文そのものではなく、`securityLevel: "strict"` の Mermaid が組んだ出力である
       * (Mermaid は同梱の DOMPurify を通してから返す)。判断は ADR 0023 に書いた。
       *
       * 外から role を被せない。Mermaid が SVG 自身に graphics-document と document の
       * role、それに aria-roledescription を付けており、ここで img の role を被せると
       * 図の中のラベルが読み上げから消える。図に題と説明を足したいときは、本文側で
       * Mermaid の accTitle と accDescr を書く。
       */
      <div
        className="mermaid-diagram"
        dangerouslySetInnerHTML={{ __html: rendered.svg }}
      />
    );
  }

  /*
   * まだ図になっていないもの。組んでいる最中と、組めなかったときの両方がここへ来る。
   *
   * `aria-busy` は決着が付くまで立てておく。JavaScript が動かない読み手には下りない
   * ままになるが、そこでは図に差し替わることも無いので、印としては正しい。
   */
  return (
    <div className="mermaid-source" aria-busy={hasSource && !isSettled}>
      {children}
    </div>
  );
}
