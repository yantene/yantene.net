import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ArticleTimeline } from "./article-timeline";
import type { ArticleTimelineItemProps } from "./article-timeline-item";

/*
 * Bridgy が記事の並びを見つける経路。h-feed が 1 つで、各項目が h-entry として
 * URL を持っていること。
 */
const articles: ArticleTimelineItemProps[] = [
  {
    slug: "hello",
    title: "こんにちは",
    summary: "ようこそ",
    imageUrl: null,
    publishedOn: "2026-08-01",
    language: "ja",
  },
  {
    slug: "older",
    title: "むかしの話",
    summary: "むかしむかし",
    imageUrl: null,
    publishedOn: "2025-03-04",
  },
];

function renderTimeline(isGroupedByYear: boolean): HTMLElement {
  const { container } = render(
    <MemoryRouter>
      <ArticleTimeline articles={articles} groupByYear={isGroupedByYear} />
    </MemoryRouter>,
  );
  return container;
}

describe("ArticleTimeline の microformats2", () => {
  it("平らな並びでは h-feed が 1 つ", () => {
    expect(renderTimeline(false).querySelectorAll(":scope .h-feed")).toHaveLength(1);
  });

  it("年で束ねても h-feed は 1 つ", () => {
    // 年ごとに feed ができると、どれが記事の並びなのか読み取れなくなる。
    expect(renderTimeline(true).querySelectorAll(":scope .h-feed")).toHaveLength(1);
  });

  it("各項目が h-entry として URL と題と日付を持つ", () => {
    const container = renderTimeline(false);
    const entries = [...container.querySelectorAll(":scope .h-entry")];
    expect(entries).toHaveLength(articles.length);

    const [first] = entries;
    expect(first.querySelector(":scope .u-url")?.getAttribute("href")).toBe("/articles/hello");
    expect(first.querySelector(":scope .p-name")?.textContent).toBe("こんにちは");
    expect(first.querySelector(":scope .dt-published")?.getAttribute("datetime")).toBe(
      "2026-08-01",
    );
  });
});

describe("ArticleTimeline の言語", () => {
  it("題と要約を記事の言語で包み、日付には付けない", () => {
    const [first] = renderTimeline(false).querySelectorAll(":scope .h-entry");

    expect(first.querySelector(":scope .p-name")?.closest("[lang]")?.getAttribute("lang")).toBe(
      "ja",
    );
    expect(first.querySelector(":scope .dt-published")?.closest("[lang]")).toBeNull();
  });

  /* 言語の欄が無い (この欄を足す前の応答を継ぎ足した) 項目は、外側の言語に任せる。 */
  it("言語を知らない項目には付けない", () => {
    const [, second] = renderTimeline(false).querySelectorAll(":scope .h-entry");

    expect(second.querySelector(":scope [lang]")).toBeNull();
  });
});
