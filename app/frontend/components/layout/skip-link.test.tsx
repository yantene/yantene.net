import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { MAIN_CONTENT_ID, MainContent } from "./main-content";
import { AppLayout } from "~/frontend/layouts/app-layout";
import { withI18n } from "~/frontend/lib/test-render";

const renderJa = withI18n("ja");
const renderEn = withI18n("en");

/** ページと同じ並び (ヘッダー → 本文) を AppLayout に通して描く。 */
function renderPage(render: typeof renderJa): void {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <AppLayout>
          <header>
            <a href="/about">About</a>
          </header>
          <MainContent>
            <h1>Title</h1>
            <a href="/articles/foo">In main</a>
          </MainContent>
        </AppLayout>
      ),
    },
  ]);
  render(<Stub initialEntries={["/"]} />, { router: false });
}

describe("SkipLink", () => {
  it("ページの最初の焦点になる", async () => {
    renderPage(renderJa);

    await userEvent.tab();

    expect(document.activeElement).toBe(screen.getByRole("link", { name: "本文へ移動" }));
  });

  it("行き先は本文の <main>", () => {
    renderPage(renderJa);

    const href = screen.getByRole("link", { name: "本文へ移動" }).getAttribute("href");
    const main = screen.getByRole("main");

    expect(href).toBe(`#${MAIN_CONTENT_ID}`);
    expect(main.id).toBe(MAIN_CONTENT_ID);
  });

  /*
   * スクロールだけさせて焦点がリンクに残ると、次の Tab がヘッダーの中へ戻る。
   * 焦点ごと本文へ移し、次の Tab は本文の中の最初のリンクへ進むこと。
   */
  it("押すと焦点が本文へ移り、次の Tab は本文の中へ進む", async () => {
    renderPage(renderJa);
    await userEvent.tab();

    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("main"));

    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "In main" }));
  });

  it("英語では Skip to content", () => {
    renderPage(renderEn);

    expect(screen.getByRole("link", { name: "Skip to content" })).toBeInTheDocument();
  });
});
