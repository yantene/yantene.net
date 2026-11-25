import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { Header } from "./header";
import type { i18n } from "i18next";
import { withI18n } from "~/frontend/lib/test-render";
import { listedFeedIdentities } from "~/lib/feed";
import { createI18nInstance } from "~/lib/i18n/init";

const renderWithI18n = withI18n();

/* サーバー描画のぶんは testing-library を通さないので、i18n を別に用意する。 */
const ssrI18n: { current?: i18n } = {};
beforeAll(async () => {
  ssrI18n.current = await createI18nInstance("ja");
});

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
    expect(destinations[0]).toEqual(["/about", "/articles", "/slides", "/works"]);
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

  /*
   * 帯の開閉 (フィード・表示する言語) とドロワーは、どれも Popover API。開閉は属性だけで
   * 決まるので、JavaScript が動かない環境でも開ける。`<dialog>` を `showModal()` で開く形
   * や自前の開閉状態にすると、その環境では押しても何も起きない飾りになる。
   *
   * どれも `auto` にする。**auto の popover は互いを閉じ合う**ので、1 つ開けば他が閉じ、
   * 板が重なることがない (ブラウザがやるので JavaScript は要らない)。
   */
  it("帯の畳んだ道具は、JavaScript 無しでも開ける器で作る", () => {
    const { container } = renderWithI18n(<Header />);

    // フィード・表示する言語・ドロワーの 3 つ。
    const triggers = [...container.querySelectorAll("button[popovertarget]")];
    expect(triggers).toHaveLength(3);
    for (const trigger of triggers) {
      const panel = container.querySelector(`[id="${trigger.getAttribute("popovertarget")}"]`);
      expect(panel).toHaveAttribute("popover", "auto");
      expect(trigger.nextElementSibling).toBe(panel);
    }
    expect(container.querySelectorAll("[popover]")).toHaveLength(3);
    expect(container.querySelector("details")).toBeNull();
  });

  /*
   * JavaScript が動かない環境で届くのはサーバーが描いた HTML だけ。そこに `popovertarget`
   * が載っていなければ、押し場所は何もしない。描画のあとで足される属性ではないことを、
   * サーバー描画の文字列で確かめる。
   */
  it("サーバーが描いた HTML に popovertarget が載っている", () => {
    const instance = ssrI18n.current;
    if (instance === undefined) throw new Error("i18n is not ready");
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={instance}>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </I18nextProvider>,
    );
    const document = new DOMParser().parseFromString(html, "text/html");

    const triggers = [...document.querySelectorAll("button[popovertarget]")];
    expect(triggers).toHaveLength(3);
    for (const trigger of triggers) {
      const panel = document.getElementById(trigger.getAttribute("popovertarget") ?? "");
      expect(panel?.getAttribute("popover")).toBe("auto");
    }
  });

  /*
   * 帯とドロワーで出来ることを変えない。ドロワーは狭い画面での帯そのものなので、
   * 片方にだけある導線を作ると、画面の幅で購読できるものが変わる。
   */
  it("フィードの行き先は帯とドロワーで揃っている", () => {
    renderWithI18n(<Header />);

    const feedHrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href) => href !== null && href.startsWith("/feed"));

    // 選び場所に出す種別 × (帯 + ドロワー)。
    expect(feedHrefs).toHaveLength(listedFeedIdentities.length * 2);
    const band = feedHrefs.slice(0, listedFeedIdentities.length);
    expect(band).toEqual(listedFeedIdentities.map((identity) => identity.path));
    expect(feedHrefs.slice(listedFeedIdentities.length)).toEqual(band);
  });
});
