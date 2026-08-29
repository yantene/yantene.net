import { useEffect } from "react";
import type { RefObject } from "react";

/** 閉じるきっかけ。呼び出し側が焦点の戻し方を決められるように区別して渡す。 */
export type DismissReason = "escape" | "outside";

export interface UseDismissParams {
  /** 開いているときだけ購読する。閉じている間まで見張らない。 */
  readonly isOpen: boolean;
  /** 「中」と見なす範囲。この中の押下では閉じない。 */
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly onDismiss: (reason: DismissReason) => void;
}

/**
 * 開いているものを Esc と外側の押下で閉じる。
 *
 * 見張るのは `pointerdown` で、`click` ではない。開閉ボタンは範囲の中にあるので、
 * 外側だけを拾えば「開いているときにボタンを押す」は素通りして、ボタン自身の
 * トグルが閉じてくれる。`click` で拾うと閉じた直後にボタンが開き直す。
 *
 * 範囲の中かどうかは `contains` で見る。パネルの中の要素を押しただけで閉じると、
 * 絞り込みの入力に触れることすらできない。
 */
export function useDismiss({ isOpen, containerRef, onDismiss }: UseDismissParams): void {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onDismiss("escape");
    }

    function handlePointerDown(event: PointerEvent): void {
      const container = containerRef.current;
      const target = event.target;
      if (container === null || !(target instanceof Node)) return;
      if (container.contains(target)) return;
      onDismiss("outside");
    }

    globalThis.addEventListener("keydown", handleKeyDown);
    globalThis.addEventListener("pointerdown", handlePointerDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
      globalThis.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, containerRef, onDismiss]);
}
