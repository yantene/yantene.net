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

  it("誰も押していなくてもハートを 0 件で出す", () => {
    renderBar({ reactions: [], mine: null });

    const like = screen.getByRole("button", { name: "いいね" });
    expect(like.textContent).toContain("❤️");
    expect(like.textContent).toContain("0");
  });

  it("ハートは常に先頭に置く (数で動かさない)", () => {
    renderBar({ reactions: [{ emoji: "🎉", count: 9 }], mine: null });

    const [likeChip, otherChip] = [
      ...document.querySelectorAll(":scope .reaction-chip"),
    ];
    expect(likeChip.textContent).toContain("❤️");
    expect(otherChip.textContent).toContain("🎉");
  });

  it("ハートも他の絵文字も同じ形で並べる", () => {
    renderBar({ reactions, mine: null });

    // ハートだけ別の姿だと、独立したトグルに見えて排他が伝わらない。
    expect(document.querySelectorAll(":scope .reaction-chip")).toHaveLength(
      reactions.length,
    );
  });

  it("押しているものだけが光る", () => {
    renderBar({ reactions, mine: "🎉" });

    const active = [
      ...document.querySelectorAll(":scope .reaction-chip.is-active"),
    ];
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toContain("🎉");
  });

  it("押しているものをもう一度押すと取り消しを送る", () => {
    renderBar({ reactions, mine: "🎉" });

    const chips = [...document.querySelectorAll(":scope .reaction-chip")];
    const mine = chips.find((chip) => chip.className.includes("is-active"));
    expect(mine?.getAttribute("value")).toBe("");
  });

  it("パレットの入口は選択肢の並びの外に置く", () => {
    renderBar({ reactions, mine: null });

    const trigger = screen.getByRole("button", { name: /絵文字を選ぶ/ });
    expect(trigger.className).not.toContain("reaction-chip");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("行に「1 つだけ」の説明を結び付ける", () => {
    renderBar({ reactions, mine: null });

    const form = screen.getByRole("form", { name: "リアクション" });
    const hintId = form.getAttribute("aria-describedby") ?? "";
    expect(hintId).not.toBe("");
    const hint = document.querySelector(`#${CSS.escape(hintId)}`);
    expect(hint?.textContent).toContain("1 つだけ");
  });
});
