import { screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();
import { describe, expect, it } from "vitest";
import About from "./about";
import { sampleHistory } from "~/frontend/components/profile/profile-fixture";

/*
 * `/about` の節の並び。
 *
 * 経歴は名乗りの直下、自己紹介の本文より前に置く
 * ([ADR 0045](../../../docs/adr/0045-show-the-history-right-under-the-profile-card.md))。
 * 年表が生まれたところから始まる自分史なので、頭から読ませる。**名乗りより上には
 * 出さない。** ページの頭にあるのは顔・名前・短い自己紹介のまま。
 *
 * 置き場所は見た目に出ないので (どの順でも「それらしく」出る)、ここで形を固定する。
 */
const ORIGIN = "https://yantene.net";

function loaderData(): unknown {
  return {
    locale: "ja",
    origin: ORIGIN,
    copyright: { from: 2024, to: 2026 },
    profile: {
      name: "やんてね",
      tagline: ["東京で Web 開発者をやっています。"],
      socials: [],
    },
    mdast: {
      type: "root",
      children: [
        { type: "heading", depth: 2, children: [{ type: "text", value: "Favorites" }] },
        { type: "paragraph", children: [{ type: "text", value: "長い自己紹介。" }] },
      ],
    },
    history: sampleHistory,
    linkCards: {},
    works: [
      {
        slug: "infoholick",
        name: "infoholick",
        summary: "読んだものを覚えておくやつ。",
        url: null,
      },
    ],
    jsonLd: {},
  };
}

async function renderPage(): Promise<HTMLElement> {
  const Stub = createRoutesStub([{ path: "/about", Component: About, loader: () => loaderData() }]);
  const { container } = renderWithI18n(<Stub initialEntries={["/about"]} />, { router: false });

  await screen.findByRole("heading", { name: "History" });
  return container;
}

/*
 * 節を指す目印。**`.mdast-prose` は MdastRenderer が出す本文の器**で、これを
 * `main p` のような緩い当て方にすると名乗りの中の tagline を拾ってしまい、本文より後か
 * どうかを見ていないテストになる。
 */
const SECTIONS = [".h-card", ".profile-history", ".mdast-prose", ".work-list"] as const;

/** 目印の要素が本文に現れる順。`compareDocumentPosition` ではなく走査順で見る。 */
function orderOf(container: HTMLElement, selectors: readonly string[]): string[] {
  const found = new Map<Element, string>();
  for (const selector of selectors) {
    const element = container.querySelector(selector);
    if (element !== null) found.set(element, selector);
  }
  return [...container.querySelectorAll("*")].flatMap((node) => {
    const label = found.get(node);
    return label === undefined ? [] : [label];
  });
}

describe("/about の節の並び", () => {
  it("経歴は名乗りの直後、本文と作ったものより前に出す", async () => {
    const container = await renderPage();

    // 1 つでも見つからなければ短い配列になって落ちる (印を取り違えたまま緑にしない)。
    expect(orderOf(container, SECTIONS)).toEqual([...SECTIONS]);
  });

  it("1 件も書いていなければ節ごと出さない", async () => {
    const Stub = createRoutesStub([
      {
        path: "/about",
        Component: About,
        loader: () => ({ ...(loaderData() as object), history: [] }),
      },
    ]);
    const { container } = renderWithI18n(<Stub initialEntries={["/about"]} />, { router: false });

    await screen.findByRole("heading", { name: "Works" });
    expect(container.querySelector(".profile-history")).toBeNull();
    expect(screen.queryByRole("heading", { name: "History" })).toBeNull();
  });
});
