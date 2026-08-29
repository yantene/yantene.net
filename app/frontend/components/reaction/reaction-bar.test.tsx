import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

function renderBar(
  state: ReactionState,
  shouldPromptReaction = false,
  action: () => unknown = () => null,
): void {
  const instance = i18nRef.current;
  if (instance === undefined) throw new Error("i18n is not ready");
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <I18nextProvider i18n={instance}>
            <ReactionBar {...state} shouldPromptReaction={shouldPromptReaction} />
          </I18nextProvider>
        ),
        action,
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

/**
 * 決着を手元で握る約束。
 *
 * 送信中の姿は往復の間しか出ないので、こちらで往復を止めないと観測できない。
 */
function defer(): {
  readonly promise: Promise<null>;
  readonly settle: () => void;
} {
  // Promise の実行子は同期に走るので、return までに必ず入れ替わっている。
  let settle = (): void => undefined;
  const promise = new Promise<null>((resolve) => {
    settle = () => {
      resolve(null);
    };
  });

  return { promise, settle };
}

/** happy-dom は localStorage を持たない。促しがそこを読むので代役を置く。 */
function createStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: () => null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

const reactions = [
  { emoji: "❤️", count: 3 },
  { emoji: "🎉", count: 1 },
];

describe("ReactionBar", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

    const [likeChip, otherChip] = [...document.querySelectorAll(":scope .reaction-chip")];
    expect(likeChip.textContent).toContain("❤️");
    expect(otherChip.textContent).toContain("🎉");
  });

  it("ハートも他の絵文字も同じ形で並べる", () => {
    renderBar({ reactions, mine: null });

    // ハートだけ別の姿だと、独立したトグルに見えて排他が伝わらない。
    expect(document.querySelectorAll(":scope .reaction-chip")).toHaveLength(reactions.length);
  });

  it("押しているものだけが光る", () => {
    renderBar({ reactions, mine: "🎉" });

    const active = [...document.querySelectorAll(":scope .reaction-chip.is-active")];
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

  /*
   * 連打が 2 度サーバーへ届くと、両方が「まだ押していない」を読んで数が 2 つ進む。
   * 取り消しても 1 しか戻らないので、差がそのまま残る (#248)。
   */
  describe("連打", () => {
    it("送信が終わるまで、2 度目からの押下は届かない", async () => {
      const pending = defer();
      let calls = 0;
      renderBar({ reactions, mine: null }, false, () => {
        calls += 1;
        return pending.promise;
      });

      const like = screen.getByRole("button", { name: "いいね" });
      await userEvent.click(like);
      await userEvent.click(like);
      await userEvent.click(like);

      expect(calls).toBe(1);
    });

    it("受け付けないことは示すが、焦点は奪わない", async () => {
      const pending = defer();
      renderBar({ reactions, mine: null }, false, () => pending.promise);

      const like = screen.getByRole("button", { name: "いいね" });
      await userEvent.click(like);

      expect(like).toHaveAttribute("aria-disabled", "true");
      // disabled にすると焦点が body へ落ちて、読み上げの現在地が失われる。
      expect(like).not.toBeDisabled();
      expect(document.activeElement).toBe(like);
    });

    it("送信が終われば、また押せる", async () => {
      const pending = defer();
      let calls = 0;
      renderBar({ reactions, mine: null }, false, () => {
        calls += 1;
        return calls === 1 ? pending.promise : null;
      });

      const like = screen.getByRole("button", { name: "いいね" });
      await userEvent.click(like);
      await act(async () => {
        pending.settle();
        await pending.promise;
      });
      await waitFor(() => {
        expect(like).toHaveAttribute("aria-disabled", "false");
      });
      await userEvent.click(like);

      expect(calls).toBe(2);
    });
  });

  /*
   * 促しは「まだ押していない人」にだけ。押したかどうかは送信中の姿 (楽観表示) で
   * 判断するので、確定を待たずに引っ込む。
   */
  describe("promoting a reaction", () => {
    it("shows the hint to someone who has not reacted", () => {
      renderBar({ reactions, mine: null }, true);

      expect(screen.getByRole("note")).toHaveTextContent("匿名でリアクションしてみよう");
    });

    it("stays quiet for someone who already reacted", () => {
      renderBar({ reactions, mine: "❤️" }, true);

      expect(screen.queryByRole("note")).toBeNull();
    });

    it("stays quiet where the caller does not ask for it", () => {
      renderBar({ reactions, mine: null });

      expect(screen.queryByRole("note")).toBeNull();
    });
  });
});
