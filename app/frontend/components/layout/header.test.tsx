import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Header } from "./header";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();

/** パレットの `<dialog>`。開いているかどうかは DOM の側が持つ。 */
function palette(): HTMLDialogElement {
  const dialog = document.querySelector("dialog.command-palette");
  if (!(dialog instanceof HTMLDialogElement)) throw new Error("palette is not rendered");
  return dialog;
}

/** 近道を押す。`meta` は Mac の ⌘、`control` はそれ以外。 */
async function pressSearchShortcut(modifier: "Control" | "Meta"): Promise<void> {
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
}

describe("Header の検索の近道", () => {
  it("はじめはパレットが閉じている", () => {
    renderWithI18n(<Header />);

    expect(palette().open).toBe(false);
  });

  /*
   * GNU/Linux と Windows のための経路。**Chrome の既定 (アドレス欄で検索) と重なる**ので、
   * ここが黙って効かなくなると、その環境からはキーボードで開けなくなる。
   */
  it("Ctrl+K で開く", async () => {
    renderWithI18n(<Header />);

    await pressSearchShortcut("Control");

    expect(palette().open).toBe(true);
  });

  it("⌘K でも開く", async () => {
    renderWithI18n(<Header />);

    await pressSearchShortcut("Meta");

    expect(palette().open).toBe(true);
  });

  /*
   * ブラウザに先を越されないよう、既定の動きを止める。止めていないと Chrome が
   * アドレス欄を取り、パレットは開いても焦点がページに無い状態になる。
   */
  it("ブラウザの既定を止める", () => {
    renderWithI18n(<Header />);

    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  /*
   * 打っている場所では奪わない。macOS の入力欄では行末までの削除に割り当たっていて、
   * 奪うと読み手の手癖を壊す。
   */
  it("字を打っている最中は奪わない", async () => {
    renderWithI18n(
      <>
        <Header />
        <input aria-label="どこか別の入力欄" />
      </>,
    );

    await userEvent.click(screen.getByLabelText("どこか別の入力欄"));
    await pressSearchShortcut("Control");

    expect(palette().open).toBe(false);
  });

  it("修飾キーを伴わない K では開かない", async () => {
    renderWithI18n(<Header />);

    await userEvent.keyboard("k");

    expect(palette().open).toBe(false);
  });
});

describe("Header の作り", () => {
  /*
   * 帯とドロワーは同じ表を読む (site-nav.tsx)。表に出ているのは常に片方だけで、
   * もう片方は幅で `display: none` になる — が、テストには CSS が無いので両方見える。
   * ここで確かめるのは「2 つとも同じ行き先を指していること」。
   */
  it("行き先は帯とドロワーで揃っている", () => {
    renderWithI18n(<Header />);

    const navigations = screen.getAllByRole("navigation", { name: "サイト" });
    expect(navigations).toHaveLength(2);

    const destinations = navigations.map((navigation) =>
      [...navigation.querySelectorAll("a")].map((link) => link.getAttribute("href")),
    );
    expect(destinations[0]).toEqual(["/about", "/articles", "/notes", "/slides"]);
    expect(destinations[1]).toEqual(destinations[0]);
  });

  /*
   * JavaScript が動かない環境では、押し場所が素のリンクとして働く。`<button>` に
   * すると、その環境では押しても何も起きない飾りになる。
   */
  it("検索の入口は、押せなくても一覧へ行けるリンクになっている", () => {
    renderWithI18n(<Header />);

    expect(screen.getAllByRole("link", { name: "Search" })[0]).toHaveAttribute("href", "/articles");
  });

  it("表示する言語は、JavaScript 無しでも切り替わるフォームで送る", () => {
    renderWithI18n(<Header />);

    const form = screen.getAllByRole("form", { name: "表示する言語" })[0];
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/locale");
  });
});
