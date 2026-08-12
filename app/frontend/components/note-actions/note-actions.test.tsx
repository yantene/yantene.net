import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { NoteActions } from "./note-actions";
import type { NoteActionsPlacement } from "./note-actions";
import type { i18n } from "i18next";
import { createI18nInstance } from "~/lib/i18n/init";

/*
 * 中の ReactionBar が useFetcher を使うので、データルータの中でしか描けない。
 * 押した結果までは見ず、置き場所ごとの区別と、両方の手が揃っていることを確かめる。
 */
const i18nRef: { current: i18n | undefined } = { current: undefined };

function renderActions(placement: NoteActionsPlacement): void {
  const instance = i18nRef.current;
  if (instance === undefined) throw new Error("i18n is not ready");

  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <I18nextProvider i18n={instance}>
            <NoteActions
              placement={placement}
              reactions={[{ emoji: "❤️", count: 2 }]}
              mine={null}
              url="https://yantene.net/notes/hello"
              title="題"
            />
          </I18nextProvider>
        ),
        action: () => null,
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("NoteActions", () => {
  beforeAll(async () => {
    i18nRef.current = await createI18nInstance("ja");
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
});
