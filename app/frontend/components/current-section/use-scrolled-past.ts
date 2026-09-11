import { useEffect, useState } from "react";

/**
 * 通り過ぎたと見なす高さ。ヘッダーの下端 (4rem = 64px)。
 *
 * **rem では書けない。** IntersectionObserver の rootMargin が受けるのは px と % だけで、
 * 他の単位を渡すと構築の時点で SyntaxError になる。effect の中で投げるので、サーバーが
 * 描いた HTML は出たあと、hydration した瞬間に記事ごとエラー画面へ落ちる。
 * ヘッダーの高さを変えたらここも直すこと (header.tsx の余白 12px + ロゴ 40px)。
 */
const STICKY_LINE = "-64px 0px 0px 0px";

/**
 * 指した要素を上へ通り過ぎたか。
 *
 * 節名バーを出し始める合図に使う。差し込み目次 (inline-table-of-contents) が画面から
 * 消えた時点で、バーがその代わりになる、という受け渡し。
 *
 * 現在地 (useActiveHeading) では代われない。あちらは一度決まると帯から見出しが外れても
 * 保たれる作りで、記事の頭まで戻っても最初の節の名前を返し続ける。表題が見えている画面に
 * 節名を出すのはおかしいので、出すかどうかはこちらで別に決める。
 *
 * 見張るのは 1 つだけ。上下どちらへ跨いでも交差が動くので、戻ったときにもちゃんと消える。
 * 要素が無ければずっと false を返す (目次の無い記事にバーは要らない)。
 *
 * 受け取るのは要素そのもので、CSS の選び方ではない。class 名で DOM から探すと、見た目の
 * ために付けた名前が動作を握り、改名したときに何も言わず壊れる。
 */
export function useScrolledPast(element: HTMLElement | null): boolean {
  const [passed, setPassed] = useState(false);

  /*
   * 見張る先が入れ替わったら一度倒す。目次のある記事から無い記事へ移ったときに「通り過ぎた」
   * が残ると、目次が無いのにバーだけが出る。
   *
   * **記事を移っても要素が同じなら、ここは通らない。** 目次は常に最初の h2 の直前に入り、
   * ルートも <Outlet /> を鍵なしで描くので、記事から記事への移動では同じ nav が使い回される。
   * その場合に古い値が残るのは、スクロールが先頭へ戻った時点で見張り手が交差の変化を報せ、
   * false に落ちるまでの間だけ。加えてバーは現在地 (useActiveHeading) が決まるまで描かれず、
   * あちらは見出しの列で倒れるので、表に出ることはない。
   *
   * 倒すのは描画中で、effect の中ではない。effect でやると一度描いてから描き直すことに
   * なり、その一瞬だけ古い節名が新しい記事に出る。描画中に state を書き換えてその場で
   * 作り直すのは React の作法で、navigation-progress.tsx が同じ形を採っている。
   */
  const [watched, setWatched] = useState(element);
  if (watched !== element) {
    setWatched(element);
    setPassed(false);
  }

  useEffect(() => {
    if (element === null) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) return;
        // 交差の根 (rootMargin を当てた後の枠) より上に抜けていれば通り過ぎている。
        const line = entry.rootBounds?.top ?? 0;
        setPassed(entry.boundingClientRect.top < line);
      },
      { rootMargin: STICKY_LINE },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [element]);

  return passed;
}
