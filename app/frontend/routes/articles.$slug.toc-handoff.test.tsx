import { act, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArticleShow from "./articles.$slug";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();

/*
 * 差し込み目次から節名バーへの受け渡しを、ページごと通して見る。
 *
 * 目次は本文の中 (MdastRenderer が差し込む) に、バーはページの直下に居る。繋いでいるのは
 * ページが持つ state と InlineTocRegistry の 2 つだけで、どちらを外しても型は通り、目次も
 * 本文も描かれ続ける。バーが静かに出なくなるだけになるので、ここで形を固定する。
 *
 * 部品ごとのテスト (current-section / inline-table-of-contents) では、この配線そのものを
 * 通らない。片方は要素を直に渡し、もう片方は預ける先を自分で用意してしまうため。
 */
const SLUG = "hello-world";
const ORIGIN = "https://yantene.net";

/** 見張り手を捕まえて、交差をこちらから起こせるようにする。 */
interface FakeObserver {
  readonly rootMargin: string;
  readonly callback: IntersectionObserverCallback;
}
let observers: FakeObserver[] = [];

/** 目次を通り過ぎたと伝える。見張り手はヘッダーの下端を見ている。 */
function setPassedToc(passed: boolean): void {
  const observer = observers.find((o) => o.rootMargin === "-64px 0px 0px 0px");
  if (observer === undefined) throw new Error("目次の見張り手が作られていない");
  act(() => {
    observer.callback(
      [
        {
          boundingClientRect: { top: passed ? -100 : 100 },
          rootBounds: { top: 0 },
        } as unknown as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  });
}

/** 現在地の見張り手に「この見出しだけが帯に入っている」と伝える。 */
function setBand(activeIds: readonly string[]): void {
  const observer = observers.find((o) => o.rootMargin === "0px 0px -80% 0px");
  if (observer === undefined) throw new Error("現在地の見張り手が作られていない");
  const entries = [...document.querySelectorAll(".mdast-prose h2, .mdast-prose h3")].map(
    (target) =>
      ({
        target,
        isIntersecting: activeIds.includes(target.id),
      }) as unknown as IntersectionObserverEntry,
  );
  act(() => {
    observer.callback(entries, {} as IntersectionObserver);
  });
}

function heading(text: string): unknown {
  return { type: "heading", depth: 2, children: [{ type: "text", value: text }] };
}

function loaderData(): unknown {
  return {
    found: true,
    locale: "ja",
    origin: ORIGIN,
    copyright: { from: 2024, to: 2026 },
    article: {
      slug: SLUG,
      title: "はじめての記事",
      summary: "ようこそ",
      imageUrl: null,
      tags: [],
      publishedOn: "2026-05-08",
      lastModifiedOn: "2026-05-08",
    },
    mdast: {
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "text", value: "リード文" }] },
        heading("ひとつめの節"),
        { type: "paragraph", children: [{ type: "text", value: "本文" }] },
        heading("ふたつめの節"),
      ],
    },
    headings: [
      { id: "ひとつめの節", text: "ひとつめの節", level: 2 },
      { id: "ふたつめの節", text: "ふたつめの節", level: 2 },
    ],
    linkCards: {},
    webmentions: { faces: [], replies: [] },
    related: [],
    reactions: { reactions: [], mine: null },
    jsonLd: {},
  };
}

async function renderPage(): Promise<HTMLElement> {
  const Stub = createRoutesStub([
    {
      path: "/articles/:slug",
      Component: ArticleShow,
      loader: () => loaderData(),
      action: () => null,
    },
  ]);
  const { container } = renderWithI18n(<Stub initialEntries={[`/articles/${SLUG}`]} />, {
    router: false,
  });
  await screen.findByRole("heading", { name: "はじめての記事" });
  return container;
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observers.push({ rootMargin: options?.rootMargin ?? "", callback });
      }
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("記事ページ: 差し込み目次から節名バーへの受け渡し", () => {
  it("目次が描かれ、その要素を見張る手が作られる", async () => {
    const container = await renderPage();

    expect(container.querySelector("nav.inline-toc")).not.toBeNull();
    // 受け渡しが切れていると、見張る先が無いので手そのものが作られない。
    expect(observers.some((o) => o.rootMargin === "-64px 0px 0px 0px")).toBe(true);
  });

  it("目次を通り過ぎるとバーが出て、戻ると消える", async () => {
    const container = await renderPage();
    const shown = (): string | null =>
      container.querySelector(".current-section-name")?.textContent ?? null;

    setBand(["ひとつめの節"]);
    expect(shown()).toBeNull();

    setPassedToc(true);
    expect(shown()).toBe("ひとつめの節");

    setPassedToc(false);
    expect(shown()).toBeNull();
  });
});
