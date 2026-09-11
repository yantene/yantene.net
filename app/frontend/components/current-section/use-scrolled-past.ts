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
 * 指した要素が無ければずっと false を返す (目次の無い記事にバーは要らない)。
 */
export function useScrolledPast(selector: string): boolean {
  const [passed, setPassed] = useState(false);

  /*
   * 記事を移ったら一度倒す。深いところまで読んだ状態から <Link> で次の記事へ移ると、
   * 新しい記事の頭に居るのに「通り過ぎた」が残り、表題の横に節名が出てしまう。
   *
   * 倒すのは描画中で、effect の中ではない。effect でやると一度描いてから描き直すことに
   * なり、その一瞬だけ古い節名が新しい記事に出る。描画中に state を書き換えてその場で
   * 作り直すのは React の作法で、navigation-progress.tsx が同じ形を採っている。
   */
  const [watched, setWatched] = useState(selector);
  if (watched !== selector) {
    setWatched(selector);
    setPassed(false);
  }

  useEffect(() => {
    const element = document.querySelector(selector);
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
  }, [selector]);

  return passed;
}
