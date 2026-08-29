import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { NoteTimeline } from "./note-timeline";
import type { NoteTimelineItemProps } from "./note-timeline-item";

/*
 * Bridgy が記事の並びを見つける経路。h-feed が 1 つで、各項目が h-entry として
 * URL を持っていること。
 */
const notes: NoteTimelineItemProps[] = [
  {
    slug: "hello",
    title: "こんにちは",
    summary: "ようこそ",
    imageUrl: null,
    publishedOn: "2026-08-01",
    tags: ["エッセイ", "日記"],
  },
  {
    slug: "older",
    title: "むかしの話",
    summary: "むかしむかし",
    imageUrl: null,
    publishedOn: "2025-03-04",
    tags: [],
  },
];

function renderTimeline(isGroupedByYear: boolean): HTMLElement {
  const { container } = render(
    <MemoryRouter>
      <NoteTimeline notes={notes} groupByYear={isGroupedByYear} />
    </MemoryRouter>,
  );
  return container;
}

describe("NoteTimeline の microformats2", () => {
  it("平らな並びでは h-feed が 1 つ", () => {
    expect(renderTimeline(false).querySelectorAll(":scope .h-feed")).toHaveLength(1);
  });

  it("年で束ねても h-feed は 1 つ", () => {
    // 年ごとに feed ができると、どれが記事の並びなのか読み取れなくなる。
    expect(renderTimeline(true).querySelectorAll(":scope .h-feed")).toHaveLength(1);
  });

  /*
   * 一覧は h-feed の中の h-entry なので、記事ページと同じ印を出す。出さないと
   * 「この記事には分類が無い」と読まれる (画面には出ているのに機械には見えない)。
   */
  it("各項目のタグが p-category として出る", () => {
    const container = renderTimeline(false);
    const [first] = [...container.querySelectorAll(":scope .h-entry")];

    const categories = [...first.querySelectorAll(":scope .p-category")].map(
      (node) => node.textContent,
    );
    expect(categories).toEqual(["エッセイ", "日記"]);
  });

  it("各項目が h-entry として URL と題と日付を持つ", () => {
    const container = renderTimeline(false);
    const entries = [...container.querySelectorAll(":scope .h-entry")];
    expect(entries).toHaveLength(notes.length);

    const [first] = entries;
    expect(first.querySelector(":scope .u-url")?.getAttribute("href")).toBe("/notes/hello");
    expect(first.querySelector(":scope .p-name")?.textContent).toBe("こんにちは");
    expect(first.querySelector(":scope .dt-published")?.getAttribute("datetime")).toBe(
      "2026-08-01",
    );
  });
});
