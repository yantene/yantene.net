import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LightboxImage } from "./lightbox-image";

/** 拡大を開く。 */
function open(): void {
  fireEvent.click(screen.getByRole("button", { name: /画像を拡大/ }));
}

/** 拡大画像 (閉じるボタン)。開いていなければ落ちる。 */
function overlay(): HTMLElement {
  return screen.getByRole("button", { name: "拡大画像を閉じる", hidden: true });
}

/** 拡大したもの。開いているときに探す。 */
function shown(name: string): HTMLDialogElement {
  return screen.getByRole("dialog", { name, hidden: true }) as HTMLDialogElement;
}

describe("LightboxImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /*
   * 包みのボタンに aria-label だけを置くと、中身から名前を計算する経路が塞がる。
   * 図が 3 つある記事では 3 つとも「画像を拡大」になり、書き手の alt がどこにも出ない (#304)。
   */
  it("書き手の alt を拡大ボタンの名前に混ぜる", () => {
    render(<LightboxImage src="/a.png" alt="D1 と R2 の関係図" />);

    expect(
      screen.getByRole("button", { name: "画像を拡大: D1 と R2 の関係図" }),
    ).toBeInTheDocument();
  });

  it("alt が無ければ用向きだけを名前にする", () => {
    render(<LightboxImage src="/a.png" />);

    expect(screen.getByRole("button", { name: "画像を拡大" })).toBeInTheDocument();
  });

  it("拡大したものは alt で名前の付いたモーダルの dialog で開く", () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    render(<LightboxImage src="/a.png" alt="関係図" />);

    open();

    const dialog = shown("関係図");
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog.open).toBe(true);
    expect(showModal).toHaveBeenCalledOnce();
  });

  /*
   * モーダルであることは `showModal()` が支援技術へ伝える。役割を書き足すと二重になる。
   */
  it("役割と aria-modal を自分では書かない", () => {
    render(<LightboxImage src="/a.png" alt="関係図" />);

    open();

    const dialog = shown("関係図");
    expect(dialog).not.toHaveAttribute("role");
    expect(dialog).not.toHaveAttribute("aria-modal");
  });

  it("alt が無ければ、拡大したものを用向きで名乗る", () => {
    render(<LightboxImage src="/a.png" />);

    open();

    expect(shown("拡大画像").open).toBe(true);
  });

  it("拡大画像を押したら閉じる", () => {
    render(<LightboxImage src="/a.png" alt="関係図" />);
    open();

    const dialog = shown("関係図");

    fireEvent.click(overlay());

    expect(dialog.open).toBe(false);
  });

  /*
   * 閉じたあとも dialog は外さない。外す合図を `close` に頼ると、Esc で `close` が来ない
   * ブラウザで「開いている」ままになり、二度と開けなくなる。ここではブラウザが閉じた
   * (Esc・戻る操作) ことを `close()` で写す。
   */
  it("ブラウザが閉じたあとも、もう一度開ける", () => {
    render(<LightboxImage src="/a.png" alt="関係図" />);
    open();
    shown("関係図").close();

    open();

    expect(shown("関係図").open).toBe(true);
  });

  /* 拡大画像を読みに行くのは押されてから。本文の `<p>` の中に `<dialog>` を描かないためでもある。 */
  it("押されるまで dialog を描かない", () => {
    render(<LightboxImage src="/a.png" alt="関係図" />);

    expect(document.querySelector("dialog")).toBeNull();
  });
});
