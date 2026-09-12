import { describe, expect, it } from "vitest";
import { articlePagePath, parseSearchPayload, searchPagePath } from "./search-results";

describe("parseSearchPayload", () => {
  it("記事の題と要約を読み取る", () => {
    const results = parseSearchPayload({
      query: "arch",
      articles: [
        {
          slug: "install-arch-linux-on-vaio-pro",
          title: "UEFI 機に Arch Linux を入れる",
          summary: "手順。",
          imageUrl: null,
          publishedOn: "2016-01-01",
          lastModifiedOn: "2016-01-02",
        },
      ],
    });

    expect(results).toEqual([
      {
        slug: "install-arch-linux-on-vaio-pro",
        title: "UEFI 機に Arch Linux を入れる",
        summary: "手順。",
      },
    ]);
  });

  it("1 件も無いのは形が違うことではない", () => {
    expect(parseSearchPayload({ query: "", articles: [] })).toEqual([]);
  });

  /*
   * 相手はネットワーク越しの unknown。型注釈で押し通さず、形が違えば null を返して
   * 呼び出し側に失敗として扱わせる。
   */
  it("形が違えば null を返す", () => {
    expect(parseSearchPayload(null)).toBeNull();
    expect(parseSearchPayload({})).toBeNull();
    expect(parseSearchPayload({ articles: "nope" })).toBeNull();
  });

  it("1 件でも読めなければ、全体を読めなかったことにする", () => {
    const results = parseSearchPayload({
      articles: [
        { slug: "a", title: "A", summary: "a" },
        { slug: "b", title: 42, summary: "b" },
      ],
    });

    expect(results).toBeNull();
  });
});

describe("行き先", () => {
  it("記事は slug から組む", () => {
    expect(articlePagePath("hacku-2016")).toBe("/articles/hacku-2016");
  });

  it("一覧へは語をクエリに載せて渡す", () => {
    expect(searchPagePath("arch linux")).toBe("/articles?q=arch+linux");
  });
});
