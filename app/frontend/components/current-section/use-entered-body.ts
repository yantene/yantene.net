import { useEffect, useState } from "react";

/**
 * 節名を出し始める高さ。ヘッダーの下端 (4rem = 64px)。ここを越えた見出しを
 * 「通り過ぎた」とみなす。
 *
 * **rem では書けない。** IntersectionObserver の rootMargin が受けるのは px と % だけで、
 * 他の単位を渡すと構築の時点で SyntaxError になる。effect の中で投げるので、サーバーが
 * 描いた HTML は出たあと、hydration した瞬間に記事ごとエラー画面へ落ちる。
 * ヘッダーの高さを変えたらここも直すこと (header.tsx の余白 12px + ロゴ 40px)。
 */
const STICKY_LINE = "-64px 0px 0px 0px";

/**
 * 最初の節の見出しを通り過ぎたか。
 *
 * 現在地 (useActiveHeading) は、一度決まると帯から見出しが外れても保たれる。節の中ほどを
 * 読んでいる間に現在地が点滅しないための作りだが、そのぶん記事の頭まで戻っても最初の節の
 * 名前を返し続ける。表題が見えている画面に「節: はじめに」と出るのはおかしいので、
 * 出すかどうかはこちらで別に決める。
 *
 * 見張るのは最初の見出し 1 つだけ。上下どちらへ跨いでも交差が動くので、戻ったときにも
 * ちゃんと消える。
 */
export function useEnteredBody(firstHeadingId: string): boolean {
  const [entered, setEntered] = useState(false);

  /*
   * 記事を移ったら一度倒す。深いところまで読んだ状態から <Link> で次の記事へ移ると、
   * 新しい記事の頭に居るのに「通り過ぎた」が残り、表題の横に節名が出てしまう。
   *
   * 倒すのは描画中で、effect の中ではない。effect でやると一度描いてから描き直すことに
   * なり、その一瞬だけ古い節名が新しい記事に出る。描画中に state を書き換えてその場で
   * 作り直すのは React の作法で、navigation-progress.tsx が同じ形を採っている。
   */
  const [watchedId, setWatchedId] = useState(firstHeadingId);
  if (watchedId !== firstHeadingId) {
    setWatchedId(firstHeadingId);
    setEntered(false);
  }

  useEffect(() => {
    if (firstHeadingId === "") return;
    const element = document.getElementById(firstHeadingId);
    if (element === null) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) return;
        // 交差の根 (rootMargin を当てた後の枠) より上に抜けていれば通り過ぎている。
        const line = entry.rootBounds?.top ?? 0;
        setEntered(entry.boundingClientRect.top < line);
      },
      { rootMargin: STICKY_LINE },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [firstHeadingId]);

  return entered;
}
