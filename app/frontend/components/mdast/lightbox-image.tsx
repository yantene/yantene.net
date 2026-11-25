import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 画像 (img) 差し替え: クリックで lightbox 拡大 (Esc / 画像か背景を押すと閉じる)。
 *
 * 拡大したものは `<dialog>` で、`showModal()` で開く。top layer に出るので z-index で
 * 重なりを争わない。Esc と Android の戻る操作で閉じること、後ろのページを inert にする
 * こと、開いている間は焦点を外へ出さないこと、閉じたら拡大ボタンへ焦点を返すことは、
 * どれもブラウザが持つ。
 */
export function LightboxImage(
  props: Readonly<React.ComponentPropsWithoutRef<"img">>,
): React.JSX.Element {
  /*
   * dialog は初めて押されたときに作り、**以後は外さない。**
   *
   * 閉じたら外す作りにすると、外す合図を `close` に頼ることになる。Esc で閉じたとき
   * `close` が来ないブラウザがある (command-palette.tsx の注意) ので、そこで「開いている」
   * ままになり、二度と開けなくなる。開け閉めは dialog 自身に任せ、React は持たない。
   *
   * 最初から描いておかないのは 2 つの理由から。本文の画像は `<p>` の中に居るが、
   * `<dialog>` は `<p>` の中に置けない (サーバーの HTML がそこで割れる)。また、開くまで
   * 拡大画像を読みに行かせないため。
   */
  const [isMounted, setIsMounted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const alt = props.alt ?? "";

  // 初めて押されたときは、dialog が描かれるのを待ってから開く。
  useLayoutEffect(() => {
    if (isMounted) showModal(dialogRef.current);
  }, [isMounted]);

  const open = (): void => {
    if (dialogRef.current === null) {
      setIsMounted(true);
      return;
    }
    showModal(dialogRef.current);
  };

  return (
    <>
      <button
        type="button"
        className="lightbox-trigger press-control"
        onClick={open}
        /*
         * 書き手の alt を名前に混ぜる。aria-label だけを置くと中身から名前を計算する
         * 経路が塞がり、図が 3 つある記事では 3 つとも「画像を拡大」になる (#304)。
         */
        aria-label={alt === "" ? "画像を拡大" : `画像を拡大: ${alt}`}
      >
        <img {...props} alt={alt} />
      </button>
      {isMounted &&
        createPortal(
          /*
           * body の下へ出す。本文の中に置くと `<p>` の中に `<dialog>` が入るうえ、
           * 画像がリンクの中に居るとき、拡大画像を押した出来事がリンクまで届く。
           * 本文の画像に当てた組版 (`.mdast-prose img`) も拡大画像に掛かってしまう。
           */
          <dialog ref={dialogRef} className="lightbox" aria-label={alt === "" ? "拡大画像" : alt}>
            {/*
             * dialog の中身はこの button 1 つで、画面いっぱいに広がる。画像を押しても
             * 背景を押しても、Enter / Space でも閉じる。開いたときに焦点を受けるのも
             * これ (中で最初に焦点を受けられるもの)。
             *
             * ここだけは押下の反応 (press-control) を付けない。画面いっぱいの暗幕を
             * 押している間だけ薄くすると、後ろのページが透けて明滅する。
             * 押した結果 (暗幕が消える) がその場で出るので、手応えは足りている。
             */}
            <button
              type="button"
              className="lightbox-overlay"
              aria-label="拡大画像を閉じる"
              onClick={() => dialogRef.current?.close()}
            >
              <img className="lightbox-full" src={props.src} alt={alt} />
            </button>
          </dialog>,
          document.body,
        )}
    </>
  );
}

/** 開いていなければ開く。開いているものに `showModal()` を重ねると、ブラウザによっては投げる。 */
function showModal(dialog: HTMLDialogElement | null): void {
  if (dialog === null || dialog.open) return;
  dialog.showModal();
}
