import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** 画像 (img) 差し替え: クリックで lightbox 拡大 (Esc / 背景クリックで閉じる)。 */
export function LightboxImage(
  props: Readonly<React.ComponentPropsWithoutRef<"img">>,
): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") setIsOpen(false);
    }
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="lightbox-trigger press-control"
        onClick={() => setIsOpen(true)}
        aria-label="画像を拡大"
      >
        <img {...props} alt={props.alt ?? ""} />
      </button>
      {isOpen &&
        createPortal(
          // オーバーレイ自体を button にして、背景クリック・Enter/Space・Esc
          // (グローバル keydown) のいずれでも閉じられるようにする。
          //
          // ここだけは押下の反応 (press-control) を付けない。画面いっぱいの暗幕を
          // 押している間だけ薄くすると、後ろのページが透けて明滅する。
          // 押した結果 (暗幕が消える) がその場で出るので、手応えは足りている。
          <button
            type="button"
            className="lightbox-overlay"
            aria-label="拡大画像を閉じる"
            onClick={() => setIsOpen(false)}
          >
            <img
              className="lightbox-full"
              src={props.src}
              alt={props.alt ?? ""}
            />
          </button>,
          document.body,
        )}
    </>
  );
}
