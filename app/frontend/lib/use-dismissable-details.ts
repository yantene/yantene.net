import { useCallback, useEffect, useRef } from "react";

/**
 * 帯の畳んだ道具がひとまとまりであることを示す名前。
 *
 * **同じ名前を持つ `<details>` は 1 つしか開かない** (排他アコーディオン)。隣を開けば
 * 前のものが畳まれるので、板が重なることがない。ブラウザがやるので JavaScript は要らず、
 * **キーボードで開いたときにも効く** — 外押しで畳む下の仕掛けは `pointerdown` で
 * 受けており、summary で Enter を押した経路では走らないため。
 *
 * 対応していないブラウザでは両方開くだけで、押せなくなるものは無い。
 *
 * ドロワー (SiteMenu) はこの組に入れない。出ているのは常にどちらか片方 (幅で出し分けて
 * いる) なので、排他にする相手がいない。
 */
export const headerMenuGroupName = "header-menu";

/**
 * `<details>` で作った開閉に、「開いたまま置き去りにしない」ぶんだけを足す。
 *
 * **器が `<details>` なのは、JavaScript が動かない環境でも開けるようにするため。**
 * `<dialog>` や自前の開閉状態にすると、その環境では押しても何も起きない飾りになる。
 * ここが足すのは Esc で畳む・外を押したら畳む の 2 つだけで、どちらも無くても操作は
 * 最後まで通る。
 *
 * **開閉は DOM の側に持たせたまま触る。** `open` を描画で渡すと、JavaScript の無い
 * 環境で開けなくなる (React が閉じた状態を描き直してしまう)。
 */
export function useDismissableDetails(): {
  readonly ref: React.RefObject<HTMLDetailsElement | null>;
  readonly close: () => void;
} {
  const ref = useRef<HTMLDetailsElement>(null);

  const close = useCallback((): void => {
    const details = ref.current;
    if (details === null || !details.open) return;
    details.open = false;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };
    /*
     * 外を押したら畳む。`click` ではなく `pointerdown` で受けるのは、押し始めた場所で
     * 判断するため。押している間に畳まれると、`click` の時点では中の要素が消えていて
     * 「外を押した」と誤って読める。
     */
    const handlePointerDown = (event: PointerEvent): void => {
      const details = ref.current;
      if (details === null || !details.open) return;
      if (event.target instanceof Node && details.contains(event.target)) return;
      close();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [close]);

  return { ref, close };
}
