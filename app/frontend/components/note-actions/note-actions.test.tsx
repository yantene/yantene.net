import { screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoteActions } from "./note-actions";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();
import type { NoteActionsPlacement } from "./note-actions";

/*
 * 中の ReactionBar が useFetcher を使うので、データルータの中でしか描けない。
 * 押した結果までは見ず、置き場所ごとの区別と、両方の手が揃っていることを確かめる。
 */
function renderActions(placement: NoteActionsPlacement, mine: string | null = null): void {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <NoteActions
            placement={placement}
            reactions={[{ emoji: "❤️", count: 2 }]}
            mine={mine}
            url="https://yantene.net/notes/hello"
            title="題"
          />
        ),
        action: () => null,
      },
    ],
    { initialEntries: ["/"] },
  );
  // router は自前で組むので、ヘルパには包ませない。
  renderWithI18n(<RouterProvider router={router} />, { router: false });
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

describe("NoteActions", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("反応する手と共有する手を両方出す", () => {
    renderActions("bottom");

    expect(screen.getByRole("button", { name: "いいね" })).toBeTruthy();
    expect(screen.getByRole("form", { name: "リアクション" })).toBeTruthy();
    // 共有はメニューの入口が出ていればよい (中身は share-menu のテストが見る)。
    expect(screen.getByRole("button", { name: /共有|コピー/ })).toBeTruthy();
  });

  it("置き場所で読み上げの名前を分ける", () => {
    renderActions("top");

    // 上下で同じものが 2 度並ぶので、名前で区別できないと行き先が分からない。
    expect(screen.getByRole("region", { name: /冒頭/ })).toBeTruthy();
  });

  it("置き場所をクラスに出す", () => {
    renderActions("top");

    const region = screen.getByRole("region", { name: /冒頭/ });
    expect(region.className).toContain("note-actions-top");
  });

  /*
   * 促しは下だけ、しかもまだ押していない人だけ。上にも出すと同じ促しが 1 記事に 2 度
   * 並び、押した人にはそもそも用がない。
   */
  it("まだ押していない人には記事の下で促しを出す", () => {
    renderActions("bottom", null);

    expect(screen.getByRole("note")).toHaveTextContent("匿名でリアクションしてみよう");
  });

  it("記事の上では促さない", () => {
    renderActions("top", null);

    expect(screen.queryByRole("note")).toBeNull();
  });

  it("すでに押した人には促さない", () => {
    renderActions("bottom", "❤️");

    expect(screen.queryByRole("note")).toBeNull();
  });
});
