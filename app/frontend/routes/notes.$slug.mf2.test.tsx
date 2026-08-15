import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createRoutesStub } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import NoteShow from "./notes.$slug";
import type { i18n } from "i18next";
import { createI18nInstance } from "~/lib/i18n/init";

/*
 * 記事全体を h-entry として束ねる印。**NoteHeader の側では見張れない。**
 *
 * h-entry は記事を包む <main> に、e-content は本文の描画に付いており、どちらもこの
 * ルートの JSX にしかない。ここが外れると、note-header.mf2.test.tsx が固定している
 * u-url / p-name / dt-published / p-author は宙に浮いた単独の項目になり、送り先の
 * パーサから見て「誰の何という記事か」が読めなくなる。個々の印が全部揃っていても、
 * 束ねる側が消えれば同じように壊れる。
 *
 * 壊れても画面には何も出ないので、ここで形を固定する。
 */
const ORIGIN = "https://yantene.net";
const SLUG = "hello-world";

/** i18n を持ち回すための入れ物。トップレベル変数を関数から書き換えない。 */
const i18nRef: { current: i18n | undefined } = { current: undefined };

beforeAll(async () => {
  i18nRef.current = await createI18nInstance("ja");
});

/** loader が返すものの代役。印に関わらない値は最小限にする。 */
function loaderData(): unknown {
  return {
    found: true,
    locale: "ja",
    origin: ORIGIN,
    currentYear: 2026,
    note: {
      slug: SLUG,
      title: "はじめてのノート",
      summary: "ようこそ",
      imageUrl: null,
      tags: ["エッセイ"],
      publishedOn: "2026-05-08",
      lastModifiedOn: "2026-05-08",
    },
    mdast: {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "本文" }],
        },
      ],
    },
    linkCards: {},
    webmentions: { faces: [], replies: [] },
    related: [],
    headings: [],
    reactions: { reactions: [], mine: null },
    jsonLd: {},
  };
}

/**
 * ルートをそのまま描く。
 *
 * NoteActions の中の ReactionBar が useFetcher を使うので、素の描画では足りず
 * データルータが要る。createRoutesStub は loader と action を備えた文脈を用意して
 * くれるので、ページの JSX をそのまま通せる。
 */
async function renderPage(): Promise<HTMLElement> {
  const instance = i18nRef.current;
  if (instance === undefined) throw new Error("i18n is not ready");

  const Stub = createRoutesStub([
    {
      path: "/notes/:slug",
      Component: NoteShow,
      loader: () => loaderData(),
      action: () => null,
    },
  ]);

  const { container } = render(
    <I18nextProvider i18n={instance}>
      <Stub initialEntries={[`/notes/${SLUG}`]} />
    </I18nextProvider>,
  );

  // loader の解決を待つ。描き終わるまでは何も出ていない。
  await screen.findByRole("heading", { name: "はじめてのノート" });
  return container;
}

describe("記事ページの microformats2", () => {
  it("記事全体を h-entry として 1 つだけ束ねる", async () => {
    // 2 つあると、送り先のパーサはどちらを主役に選ぶか決められなくなる。
    const container = await renderPage();

    expect(container.querySelectorAll(":scope .h-entry")).toHaveLength(1);
  });

  it("本文を e-content として h-entry の中に置く", async () => {
    const container = await renderPage();
    const content = container.querySelector(":scope .e-content");

    expect(content).not.toBeNull();
    expect(content?.closest(".h-entry")).not.toBeNull();
  });

  it("NoteHeader の印が h-entry の中に入っている", async () => {
    /*
     * 個々の印の中身は note-header.mf2.test.tsx が見る。ここで確かめるのは
     * 「束ねる側の中に入っているか」だけ。入れ子が崩れると、印が揃っていても
     * entry のプロパティとしては読まれない。
     */
    const container = await renderPage();
    const entry = container.querySelector(":scope .h-entry");

    for (const marker of ["u-url", "p-name", "dt-published", "p-author"]) {
      expect(entry?.querySelector(`:scope .${marker}`)).not.toBeNull();
    }
  });
});
