import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { reserveScrollbarGutter } from "~/frontend/lib/scrollbar-gutter";

/** 下に払ったと見なす距離 (px)。字を選ぼうとした指のぶれでは閉じない程度に取る。 */
const SWIPE_CLOSE_DISTANCE = 64;

export interface FootnoteDrawerProps {
  /** 閉じた。Esc・背景・下に払う・閉じるボタンのどれでも、ここへ来る。 */
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}

/** 払い始めの位置。中身を巻いている途中の指は、払ったことにしない。 */
interface SwipeStart {
  readonly y: number;
  readonly scrolledToTop: boolean;
}

/**
 * タッチで脚注を読むためのドロワー。画面の下端から出る。
 *
 * 器は `<dialog>` で、`showModal()` で開く。Esc で閉じること、開いている間は後ろの
 * 本文に焦点が抜けないこと、閉じたら元のリンクへ焦点が戻ることは、ブラウザが持つ。
 *
 * 閉じ方は 4 つ。背景を押す・下に払う・閉じるボタン・Esc。中のリンクを押したときも
 * 閉じる (行き先が後ろの本文の中だと、ドロワーの陰で動いて見えない)。背景を押して閉じるのは
 * `closedby="any"` でブラウザに任せ、それを知らないブラウザ (Safari) でだけ自分で閉じる。
 *
 * **指に付いては動かさない。** 追わせるには位置を `style` 属性へ書き続けることになる
 * (`style` 属性を書かない規約)。払ったかどうかを離した時点で決め、閉じるだけにする。
 */
export function FootnoteDrawer({ onClose, children }: FootnoteDrawerProps): React.JSX.Element {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const body = bodyRef.current;
    if (dialog === null || body === null) return;

    /*
     * 開いている間は後ろの本文を止める (preview.css の `html:has(...)`)。止めると
     * スクロールバーが消えて本文が横へ寄るので、その場所を空けておく。**測るのは開く前。**
     */
    const releaseGutter = reserveScrollbarGutter();
    dialog.showModal();

    let swipe: SwipeStart | null = null;
    // 押されたときではなく、開いたときに 1 度だけ見る。SSR では effect が走らないので安全。
    const browserClosesOnBackdrop = "closedBy" in HTMLDialogElement.prototype;

    /*
     * 中のリンクを押したら閉じる。これはブラウザが持たないので、どのブラウザでも自分で閉じる。
     *
     * 背景を押したときは、`closedby` を知らないブラウザでだけ自分で閉じる。`::backdrop` を
     * 押した出来事は dialog 自身に届くので、「中身ではなく dialog そのものが押された」ことで
     * 見分ける (dialog に余白を置いていないので、これで足りる。preview.css)。
     */
    function onClick(event: MouseEvent): void {
      const pressedLink = event.target instanceof Element && event.target.closest("a") !== null;
      const pressedBackdrop = !browserClosesOnBackdrop && event.target === dialog;
      if (pressedLink || pressedBackdrop) dialog?.close();
    }
    function onTouchStart(event: TouchEvent): void {
      const y = event.touches[0]?.clientY;
      swipe = y === undefined ? null : { y, scrolledToTop: (body?.scrollTop ?? 0) <= 0 };
    }
    function onTouchEnd(event: TouchEvent): void {
      const start = swipe;
      swipe = null;
      const y = event.changedTouches[0]?.clientY;
      if (start === null || y === undefined || !start.scrolledToTop) return;
      if (y - start.y >= SWIPE_CLOSE_DISTANCE) dialog?.close();
    }

    dialog.addEventListener("click", onClick);
    dialog.addEventListener("touchstart", onTouchStart, { passive: true });
    dialog.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      dialog.removeEventListener("click", onClick);
      dialog.removeEventListener("touchstart", onTouchStart);
      dialog.removeEventListener("touchend", onTouchEnd);
      releaseGutter();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="footnote-drawer"
      aria-label={t("preview.footnoteLabel")}
      closedby="any"
      onClose={onClose}
    >
      <div className="footnote-drawer-sheet">
        {/* 払えることを示すつまみ。押すものではないので、読み上げには出さない。 */}
        <div className="footnote-drawer-grip" aria-hidden="true" />
        <div ref={bodyRef} className="footnote-drawer-body">
          {children}
        </div>
        <button
          type="button"
          className="footnote-drawer-close press-control"
          onClick={() => dialogRef.current?.close()}
        >
          {t("preview.close")}
        </button>
      </div>
    </dialog>
  );
}
