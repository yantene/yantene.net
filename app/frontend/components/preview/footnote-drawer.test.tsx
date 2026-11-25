import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FootnoteDrawer } from "./footnote-drawer";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();

/*
 * 開く・閉じる・払うの振る舞いは、本文から開く経路ごと mdast-renderer.preview.test.tsx が
 * 見ている。ここで見るのは、背景を押したときの閉じ方をブラウザと分け合う部分と、
 * スクロールバーの場所を空ける印。
 */
function renderDrawer(): HTMLDialogElement {
  renderWithI18n(
    <FootnoteDrawer onClose={() => undefined}>
      <p>
        注の中身。<a href="#fn-ref-1">戻る</a>
      </p>
    </FootnoteDrawer>,
  );
  return screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;
}

/** `closedby` を知っているブラウザのふりをする。 */
function supportClosedBy(): void {
  Object.defineProperty(HTMLDialogElement.prototype, "closedBy", {
    configurable: true,
    value: "any",
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "closedBy");
  document.documentElement.removeAttribute("data-modal-gutter");
});

describe("FootnoteDrawer", () => {
  it("背景を押したら閉じる、をブラウザに任せる印を付ける", () => {
    const dialog = renderDrawer();

    expect(dialog).toHaveAttribute("closedby", "any");
    expect(dialog.open).toBe(true);
  });

  /*
   * `closedby` を知っているブラウザでは、背景の押下でブラウザが閉じる。こちらからも
   * 閉じに行くと 1 回の押下で 2 度閉じることになる。
   */
  it("closedby を知っているブラウザでは、背景の押下を自分では閉じない", () => {
    supportClosedBy();
    const dialog = renderDrawer();

    fireEvent.click(dialog);

    expect(dialog.open).toBe(true);
  });

  it("知らないブラウザ (Safari) では、背景の押下で自分で閉じる", () => {
    const dialog = renderDrawer();

    fireEvent.click(dialog);

    expect(dialog.open).toBe(false);
  });

  /* 行き先が後ろの本文の中だと、ドロワーの陰で動いて見えない。これはブラウザが持たない。 */
  it("closedby を知っているブラウザでも、中のリンクを押したら閉じる", () => {
    supportClosedBy();
    const dialog = renderDrawer();

    fireEvent.click(screen.getByRole("link", { name: "戻る", hidden: true }));

    expect(dialog.open).toBe(false);
  });

  it("スクロールバーが出ていれば、開いている間その場所を空けておく", () => {
    vi.spyOn(globalThis, "innerWidth", "get").mockReturnValue(1024);
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1009);

    const { unmount } = renderWithI18n(
      <FootnoteDrawer onClose={() => undefined}>
        <p>注の中身。</p>
      </FootnoteDrawer>,
    );
    expect(document.documentElement).toHaveAttribute("data-modal-gutter");

    unmount();
    expect(document.documentElement).not.toHaveAttribute("data-modal-gutter");
  });
});
