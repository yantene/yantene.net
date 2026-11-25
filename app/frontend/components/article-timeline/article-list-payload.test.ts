import { describe, expect, it } from "vitest";
import { parseArticleListPayload } from "./article-list-payload";

function payload(article: Record<string, unknown>): unknown {
  return { articles: [article], pagination: { totalPages: 1 } };
}

const article = {
  slug: "hello",
  title: "こんにちは",
  summary: "ようこそ",
  imageUrl: null,
  publishedOn: "2026-08-01",
};

describe("parseArticleListPayload の言語", () => {
  it("記事の言語を値を選ばずに通す", () => {
    expect(parseArticleListPayload(payload({ ...article, language: "en" }))?.articles).toEqual([
      { ...article, language: "en" },
    ]);
  });

  /*
   * 言語の欄が無い応答 (欄を足す前にキャッシュに載ったもの) も読む。弾くと続きの
   * 継ぎ足しが止まる。無ければ lang を付けないだけ。
   */
  it("言語の欄が無くても読める", () => {
    expect(parseArticleListPayload(payload(article))?.articles).toEqual([article]);
  });

  it("言語が文字列でなければ形が違う", () => {
    expect(parseArticleListPayload(payload({ ...article, language: 1 }))).toBeNull();
  });
});
