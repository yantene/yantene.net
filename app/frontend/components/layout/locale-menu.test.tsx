import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleMenu } from "./locale-menu";
import { withI18n } from "~/frontend/lib/test-render";
import { localePath, supportedLocales } from "~/lib/i18n/locale";

const renderWithI18n = withI18n();

describe("LocaleMenu", () => {
  /*
   * 器は `<details>`、中身は素の `<form method="post">`。**どちらも JavaScript が
   * 動かない環境で切り替えられるようにするため。** `<dialog>` や自前の開閉状態、
   * React Router の `<Form>` にすると、その環境では開けないか送れないかになる。
   */
  it("器は details で、はじめは畳まれている", () => {
    const { container } = renderWithI18n(<LocaleMenu />);

    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
  });

  it("JavaScript 無しでも切り替わるフォームで送る", () => {
    renderWithI18n(<LocaleMenu />);

    const form = screen.getByRole("form", { name: "表示する言語" });
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", localePath);
  });

  it("戻り先を添えて送る (選んだ後に元のページへ帰るため)", () => {
    const { container } = renderWithI18n(<LocaleMenu />);

    expect(container.querySelector('input[name="return-to"]')).toHaveValue("/");
  });

  /*
   * 畳んだ先では略号 (EN / JA) ではなく言語の名前そのものを出す。帯に 2 つ並べていた
   * ときは幅のために略号にしていたが、板の中なら full の名前が入る。
   */
  it("言語の名前をその言語で出す", () => {
    renderWithI18n(<LocaleMenu />);

    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("lang", "en");
    expect(screen.getByRole("button", { name: "日本語" })).toHaveAttribute("lang", "ja");
  });

  /*
   * **いま選ばれている側も押せるままにしておく。** 無効にすると、cookie がまだ無い
   * (Accept-Language で決まっている) 読み手が、いま出ている言語を明示的に選べなくなる。
   */
  it("いま選ばれている側も押せる", () => {
    renderWithI18n(<LocaleMenu />);

    // テストの i18n は ja で立ち上げてある (test-render の既定)。
    const current = screen.getByRole("button", { name: "日本語" });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "English" })).not.toHaveAttribute("aria-current");
  });

  it("選べるのは対応している言語だけ", () => {
    const { container } = renderWithI18n(<LocaleMenu />);

    const values = [...container.querySelectorAll('button[name="locale"]')].map((button) =>
      button.getAttribute("value"),
    );
    expect(values).toEqual([...supportedLocales]);
  });
});
