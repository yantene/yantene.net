import { describe, expect, it } from "vitest";
import { parseWorkContent, WorkContentError } from "./work-content-parser";

const REQUIRED = "name: infoholick\nsummary: 読んだものを覚えておくやつ。\nposition: 0\n";

function parse(extra: string): ReturnType<typeof parseWorkContent> {
  return parseWorkContent(`---\n${REQUIRED}${extra}---\n\n本文。\n`);
}

describe("parseWorkContent: 足した欄はどれも省略できる", () => {
  it("reads a work that writes none of them", () => {
    const parsed = parse("");

    expect(parsed.featured).toBe(false);
    expect(parsed.stack.toArray()).toEqual([]);
    expect(parsed.period).toBeUndefined();
    expect(parsed.role).toBeUndefined();
    expect(parsed.screenshots).toEqual([]);
    expect(parsed.articleSlugs).toEqual([]);
  });

  /** YAML で値を書かずに置いた欄 (`stack:`) は null で届く。書いていないのと同じに扱う。 */
  it("treats a key left empty as omitted", () => {
    const parsed = parse("featured:\nstack:\nperiod:\nrole:\nscreenshots:\narticles:\n");

    expect(parsed.featured).toBe(false);
    expect(parsed.stack.toArray()).toEqual([]);
    expect(parsed.period).toBeUndefined();
    expect(parsed.role).toBeUndefined();
    expect(parsed.screenshots).toEqual([]);
    expect(parsed.articleSlugs).toEqual([]);
  });
});

describe("parseWorkContent: 書式どおりに書いた作品", () => {
  const parsed = parse(
    [
      "featured: true",
      "stack: [TypeScript, Cloudflare Workers, Hono]",
      "period:",
      "  from: 2024",
      "  until: 2025",
      "role: 設計から運用まで 1 人で担当",
      "screenshots:",
      "  - src: ./top.png",
      "    alt: 新着記事が要約つきで並ぶトップ画面",
      "  - src: ./reader-mobile.png",
      "    alt: スマートフォンで記事を開いた画面",
      "    kind: mobile",
      "articles:",
      "  - why-i-built-infoholick",
      "",
    ].join("\n"),
  );

  it("reads featured, stack and role", () => {
    expect(parsed.featured).toBe(true);
    expect(parsed.stack.toArray()).toEqual(["TypeScript", "Cloudflare Workers", "Hono"]);
    expect(parsed.role?.toString()).toBe("設計から運用まで 1 人で担当");
  });

  it("reads the period with the precision the writer chose", () => {
    expect(parsed.period?.from.toString()).toBe("2024");
    expect(parsed.period?.until?.toString()).toBe("2025");
  });

  /** `src` は書かれたまま。配る URL への解決は同期の側が行う。 */
  it("reads screenshots in the written order, defaulting kind to desktop", () => {
    expect(parsed.screenshots.map((screenshot) => screenshot.toJSON())).toEqual([
      {
        src: "./top.png",
        alt: "新着記事が要約つきで並ぶトップ画面",
        kind: "desktop",
        width: undefined,
        height: undefined,
      },
      {
        src: "./reader-mobile.png",
        alt: "スマートフォンで記事を開いた画面",
        kind: "mobile",
        width: undefined,
        height: undefined,
      },
    ]);
  });

  it("reads the article slugs", () => {
    expect(parsed.articleSlugs.map((slug) => slug.toString())).toEqual(["why-i-built-infoholick"]);
  });
});

describe("parseWorkContent: 時期", () => {
  it.each([
    ["from: 2024-06\n  until: 2025-03", "2024-06", "2025-03"],
    ["from: 2024-06-04\n  until: 2024-06-18", "2024-06-04", "2024-06-18"],
  ])("reads %s", (body, from, until) => {
    const parsed = parse(`period:\n  ${body}\n`);
    expect(parsed.period?.from.toString()).toBe(from);
    expect(parsed.period?.until?.toString()).toBe(until);
  });

  it("allows a period without an end", () => {
    const parsed = parse("period:\n  from: 2024-06\n");
    expect(parsed.period?.from.toString()).toBe("2024-06");
    expect(parsed.period?.until).toBeUndefined();
  });
});

describe("parseWorkContent: 読めない値は作品ごと諦める", () => {
  it.each([
    ["featured が真偽値でない (yes)", "featured: yes\n"],
    ['featured が文字列 ("true")', 'featured: "true"\n'],
    ["featured が数", "featured: 1\n"],
    ["stack が並びでない", "stack: TypeScript\n"],
    ["stack に文字列でないものがある", "stack: [TypeScript, 3]\n"],
    ["stack に同じ名前が 2 つ", "stack: [Hono, Hono]\n"],
    ["period が文字列", "period: 2024\n"],
    ["period に from が無い", "period:\n  until: 2025\n"],
    ["period の精度が揃っていない", "period:\n  from: 2024\n  until: 2025-03\n"],
    ["period の終わりが始まりより前", "period:\n  from: 2025\n  until: 2024\n"],
    ["period の終わりが始まりと同じ", "period:\n  from: 2024-06\n  until: 2024-06\n"],
    ["period の桁が埋まっていない", "period:\n  from: 2024-6\n"],
    ["role が 2 行", "role: |\n  1 行目\n  2 行目\n"],
    ["role が数", "role: 3\n"],
    ["screenshots が並びでない", "screenshots: ./top.png\n"],
    ["screenshots の要素が文字列", "screenshots:\n  - ./top.png\n"],
    ["screenshot に src が無い", "screenshots:\n  - alt: トップ画面\n"],
    ["screenshot に alt が無い", "screenshots:\n  - src: ./top.png\n"],
    ["screenshot の alt が空", 'screenshots:\n  - src: ./top.png\n    alt: ""\n'],
    [
      "screenshot の kind が知らない値",
      "screenshots:\n  - src: ./top.png\n    alt: トップ画面\n    kind: tablet\n",
    ],
    [
      "同じ screenshot を 2 回",
      "screenshots:\n  - src: ./top.png\n    alt: a\n  - src: ./top.png\n    alt: b\n",
    ],
    ["articles が並びでない", "articles: hello\n"],
    ["articles に slug として読めない字", "articles:\n  - Why I Built It\n"],
    ["articles に文字列でないもの", "articles:\n  - 3\n"],
    ["articles に同じ slug が 2 つ", "articles:\n  - hello\n  - hello\n"],
  ])("%s", (_label, extra) => {
    expect(() => parse(extra)).toThrow(WorkContentError);
  });

  /** 数の上限は D1 のバインドパラメータ上限に由来する (手元では踏めない)。 */
  it("rejects more screenshots than a work may carry", () => {
    const items = Array.from(
      { length: 13 },
      (_unused, index) => `  - src: ./${String(index)}.png\n    alt: 画面 ${String(index)}\n`,
    ).join("");
    expect(() => parse(`screenshots:\n${items}`)).toThrow("too many screenshots");
  });

  it("rejects more articles than a work may carry", () => {
    const items = Array.from(
      { length: 31 },
      (_unused, index) => `  - article-${String(index)}\n`,
    ).join("");
    expect(() => parse(`articles:\n${items}`)).toThrow("too many articles");
  });
});
