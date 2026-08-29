import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactionHint } from "./reaction-hint";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();

const dismissedKey = "yantene:reaction-hint-dismissed";

/**
 * localStorage の代役。
 *
 * happy-dom は `localStorage` を持たないので、ここで用意する。本番の読み書きと同じ形
 * (キーが無ければ null) にしておけば、実装の分岐をそのまま試せる。
 */
function createStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    // 使わないが Storage の形を満たすために置く。
    key: () => null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

function renderHint(): void {
  renderWithI18n(<ReactionHint />, { router: false });
}

describe("ReactionHint", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("promotes reacting to a reader who has not dismissed it", () => {
    renderHint();
    expect(screen.getByRole("note")).toHaveTextContent("匿名でリアクションしてみよう");
  });

  it("goes away when closed, and stays away afterwards", async () => {
    const user = userEvent.setup();
    renderHint();

    await user.click(screen.getByRole("button", { name: "この案内を閉じる" }));
    expect(screen.queryByRole("note")).toBeNull();

    // 記録が残るので、次に描いたときはもう出ない。
    renderHint();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("stays hidden for a reader who dismissed it before", () => {
    globalThis.localStorage.setItem(dismissedKey, "1");
    renderHint();
    expect(screen.queryByRole("note")).toBeNull();
  });

  /*
   * 閉じられない環境では出さない。localStorage を読むだけで落ちるブラウザ
   * (Safari のプライベートブラウズなど) でも、握って何もしないこと。
   */
  it("does not throw when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);

    expect(() => {
      renderHint();
    }).not.toThrow();
    expect(screen.queryByRole("note")).toBeNull();
  });

  /*
   * `getItem` は通るのに `setItem` だけ落ちる環境がある (容量超過、方針でストレージを
   * 止めている場合など)。記録は残せないが、**バツを押したら閉じられること**は守る。
   */
  it("still closes when the dismissal cannot be recorded", async () => {
    const user = userEvent.setup();
    const readable = createStorage();
    vi.stubGlobal("localStorage", {
      get length() {
        return readable.length;
      },
      clear: () => readable.clear(),
      getItem: (key: string) => readable.getItem(key),
      key: () => null,
      removeItem: (key: string) => readable.removeItem(key),
      // 読めるのに書けない環境を作る (容量超過など)。
      setItem: () => {
        throw new Error("quota exceeded");
      },
    });

    renderHint();
    await user.click(screen.getByRole("button", { name: "この案内を閉じる" }));

    expect(screen.queryByRole("note")).toBeNull();
  });
});
