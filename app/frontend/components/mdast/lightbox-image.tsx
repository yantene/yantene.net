import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** 画像 (img) 差し替え: クリックで lightbox 拡大 (Esc / 背景クリックで閉じる)。 */
export function LightboxImage(
  props: Readonly<React.ComponentPropsWithoutRef<"img">>,
): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLButtonElement>(null);
  const alt = props.alt ?? "";

  const close = useCallback(() => {
    setIsOpen(false);
    // 開く前に居た場所へ返す。返さないと焦点が body に落ち、次の Tab が本文の先頭から
    // やり直しになる。この時点ではまだ暗幕が居るが、焦点は先に移せる。
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // 暗幕を出したら焦点もそちらへ移す。置いていかれると、キーボードの利用者は
    // 見えなくなった本文を Tab で辿ることになる。
    overlayRef.current?.focus();

    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        close();
        return;
      }
      /*
       * 開いている間は Tab で外へ出さない。暗幕の中で焦点を受けるのは閉じるボタン
       * (暗幕そのもの) だけなので、送り先が無い。止めておけば焦点はそこに留まる。
       */
      if (event.key === "Tab") event.preventDefault();
    }
    globalThis.addEventListener("keydown", onKey);
    return () => {
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="lightbox-trigger press-control"
        onClick={() => setIsOpen(true)}
        /*
         * 書き手の alt を名前に混ぜる。aria-label だけを置くと中身から名前を計算する
         * 経路が塞がり、図が 3 つある記事では 3 つとも「画像を拡大」になる (#304)。
         */
        aria-label={alt === "" ? "画像を拡大" : `画像を拡大: ${alt}`}
      >
        <img {...props} alt={alt} />
      </button>
      {isOpen &&
        createPortal(
          // 包みは名前と「今はこれだけ」を支援技術へ伝えるためだけに置く。位置は
          // 暗幕が fixed で決めるので、この div は見た目に関わらない。
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt === "" ? "拡大画像" : alt}
          >
            {/*
             * オーバーレイ自体を button にして、背景クリック・Enter/Space・Esc
             * (グローバル keydown) のいずれでも閉じられるようにする。
             *
             * ここだけは押下の反応 (press-control) を付けない。画面いっぱいの暗幕を
             * 押している間だけ薄くすると、後ろのページが透けて明滅する。
             * 押した結果 (暗幕が消える) がその場で出るので、手応えは足りている。
             */}
            <button
              ref={overlayRef}
              type="button"
              className="lightbox-overlay"
              aria-label="拡大画像を閉じる"
              onClick={close}
            >
              <img className="lightbox-full" src={props.src} alt={alt} />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
