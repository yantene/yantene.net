import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { ReactionBar } from "./reaction-bar";
import type { ReactionState } from "./reaction-state";
import type { i18n } from "i18next";
import { createI18nInstance } from "~/lib/i18n/init";

/*
 * ReactionBar は useFetcher を使うので、データルータの中でしか描けない。
 * 送信までは見ず、「1 つだけ選べる」ことが印として出ているかを確かめる。
 */
/** 用意した i18n を持ち回すための入れ物。トップレベル変数を関数から書き換えない。 */
const i18nRef: { current: i18n | undefined } = { current: undefined };

function renderBar(state: ReactionState): void {
  const instance = i18nRef.current;
  if (instance === undefined) throw new Error("i18n is not ready");
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <I18nextProvider i18n={instance}>
            <ReactionBar {...state} />
          </I18nextProvider>
        ),
        action: () => null,
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

const reactions = [
  { emoji: "❤️", count: 3 },
  { emoji: "🎉", count: 1 },
];

describe("ReactionBar", () => {
  beforeAll(async () => {
    i18nRef.current = await createI18nInstance("ja");
  });

  it("ハートと絵文字を 1 つのまとまりに入れる", () => {
    renderBar({ reactions, mine: null });

    const group = screen.getByRole("group", { name: "リアクション" });
    // ハート (いいね) と押されている絵文字が同じまとまりに居る。
    expect(group.querySelectorAll(":scope button")).toHaveLength(
      reactions.length + 1,
    );
  });

  it("まとまりに「1 つだけ」の説明を結び付ける", () => {
    renderBar({ reactions, mine: null });

    const group = screen.getByRole("group", { name: "リアクション" });
    const hintId = group.getAttribute("aria-describedby") ?? "";
    expect(hintId).not.toBe("");
    const hint = document.querySelector(`#${CSS.escape(hintId)}`);
    expect(hint?.textContent).toContain("1 つだけ");
  });

  it("パレットの入口はまとまりの外に置く", () => {
    renderBar({ reactions, mine: null });

    const group = screen.getByRole("group", { name: "リアクション" });
    const trigger = screen.getByRole("button", { name: /他の絵文字を選ぶ/ });
    expect(group.contains(trigger)).toBe(false);
  });

  it("押しているものがあるとまとまりを縁取る", () => {
    renderBar({ reactions, mine: "🎉" });

    const group = screen.getByRole("group", { name: "リアクション" });
    expect(group.dataset["chosen"]).toBe("true");
  });

  it("何も押していなければ縁取らない", () => {
    renderBar({ reactions, mine: null });

    const group = screen.getByRole("group", { name: "リアクション" });
    expect(group.dataset["chosen"]).toBe("false");
  });

  it("絵文字を押しているときハートは消灯する (同じ 1 枠のため)", () => {
    renderBar({ reactions, mine: "🎉" });

    const like = screen.getByRole("button", { name: /いいね/ });
    expect(like.getAttribute("aria-pressed")).toBe("false");
  });
});
