import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LightboxImage } from "./lightbox-image";

/** 拡大を開く。 */
function open(): void {
  fireEvent.click(screen.getByRole("button", { name: /画像を拡大/ }));
}

/** 暗幕 (閉じるボタン)。開いていなければ落ちる。 */
function overlay(): HTMLElement {
  return screen.getByRole("button", { name: "拡大画像を閉じる" });
}

describe("LightboxImage", () => {
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

    expect(
      screen.getByRole("button", { name: "画像を拡大" }),
    ).toBeInTheDocument();
  });

  it("拡大したものは alt で名前の付いた dialog になる", () => {
    render(<LightboxImage src="/a.png" alt="関係図" />);

    open();

    const dialog = screen.getByRole("dialog", { name: "関係図" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  /*
   * 焦点を置いていくと、キーボードの利用者は見えなくなった本文を Tab で辿ることになる。
   */
  it("開いたら焦点を暗幕へ移す", () => {
    render(<LightboxImage src="/a.png" alt="関係図" />);

    open();

    expect(overlay()).toHaveFocus();
  });

  it("閉じたら焦点を元のボタンへ戻す", () => {
    render(<LightboxImage src="/a.png" alt="関係図" />);
    const trigger = screen.getByRole("button", { name: /画像を拡大/ });
    open();

    fireEvent.click(overlay());

    expect(trigger).toHaveFocus();
  });

  it("Esc で閉じたときも焦点を戻す", () => {
    render(<LightboxImage src="/a.png" alt="関係図" />);
    const trigger = screen.getByRole("button", { name: /画像を拡大/ });
    open();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  /*
   * 暗幕の中で焦点を受けるのは閉じるボタンだけなので、Tab の送り先が無い。
   * 止めないと後ろの本文へ抜けていく。
   */
  it("開いている間は Tab で外へ出さない", () => {
    render(<LightboxImage src="/a.png" alt="関係図" />);
    open();

    const didMove = fireEvent.keyDown(document, { key: "Tab" });

    // preventDefault されていれば dispatchEvent は false を返す。
    expect(didMove).toBe(false);
    expect(overlay()).toHaveFocus();
  });

  it("閉じていれば Tab を止めない", () => {
    render(<LightboxImage src="/a.png" alt="関係図" />);

    const didMove = fireEvent.keyDown(document, { key: "Tab" });

    expect(didMove).toBe(true);
  });
});
