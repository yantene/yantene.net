import { describe, expect, it } from "vitest";
import { WebmentionAuthor } from "./webmention-author.vo";
import { WebmentionContent } from "./webmention-content.vo";
import { WebmentionUrl } from "./webmention-url.vo";

/*
 * 外部サイトから読み取った文字列は、保存の時点で HTML を落としたテキストにする。
 * 表示側は素の文字列として出す前提なので、ここが崩れると画面に生タグが出る。
 */
describe("WebmentionContent", () => {
  it("タグを落としてテキストにする", () => {
    expect(WebmentionContent.fromText("<p>Nice <b>post</b>!</p>")?.toString()).toBe("Nice post !");
  });

  it("タグを落としたあとで実体参照を戻す", () => {
    // 順序が逆だと `&lt;script&gt;` が本物のタグに化ける。
    expect(WebmentionContent.fromText("&lt;script&gt;alert(1)&lt;/script&gt;")?.toString()).toBe(
      "<script>alert(1)</script>",
    );
  });

  it("改行と連続する空白は詰める", () => {
    expect(WebmentionContent.fromText("a\n\n  b\tc")?.toString()).toBe("a b c");
  });

  /* 相手のページ全体を積まれないよう、上限で切る。 */
  it("長すぎる本文は切り詰める", () => {
    const content = WebmentionContent.fromText("あ".repeat(2000));

    expect(content?.toString()).toHaveLength(1000);
  });

  it("中身が無ければ undefined", () => {
    expect(WebmentionContent.fromText(" ".repeat(3))).toBeUndefined();
    expect(WebmentionContent.fromText("<br>")).toBeUndefined();
  });

  /*
   * 保存済みの値を読み戻すときに均し直さないこと。掛け直すと、均した結果に残った
   * `<` をタグの始まりと見なして落としてしまい、読んだ値が保存した値と変わる。
   */
  it("保存済みの値は均し直さずに戻す", () => {
    const stored = "<script>alert(1)</script>";

    expect(WebmentionContent.reconstruct(stored)?.toString()).toBe(stored);
    // 均し直す方を通すと、こうなってしまう。
    expect(WebmentionContent.fromText(stored)?.toString()).toBe("alert(1)");
  });
});

describe("WebmentionAuthor", () => {
  it("名前は HTML を落としたテキストになる", () => {
    const author = WebmentionAuthor.create({ name: "<i>Alice</i>" });

    expect(author.name).toBe("Alice");
  });

  it("名乗らない相手も受け入れる", () => {
    const author = WebmentionAuthor.anonymous();

    expect(author.name).toBeUndefined();
    expect(author.url).toBeUndefined();
    expect(author.photo).toBeUndefined();
  });

  it("名前が長すぎれば切り詰める", () => {
    expect(WebmentionAuthor.create({ name: "x".repeat(500) }).name).toHaveLength(100);
  });

  it("復元時に名前を均し直さない", () => {
    const author = WebmentionAuthor.reconstruct({
      name: "<Alice>",
      url: null,
      photo: null,
    });

    expect(author.name).toBe("<Alice>");
  });

  /* 行が壊れていても、読める部分だけで復元する。 */
  it("復元時に読めない URL は落として名前だけ残す", () => {
    const author = WebmentionAuthor.reconstruct({
      name: "Alice",
      url: "javascript:alert(1)",
      photo: null,
    });

    expect(author.name).toBe("Alice");
    expect(author.url).toBeUndefined();
  });

  it("JSON では欠けた値を null で表す", () => {
    const author = WebmentionAuthor.create({
      name: "Alice",
      url: WebmentionUrl.create("https://alice.example/"),
    });

    expect(author.toJSON()).toEqual({
      name: "Alice",
      url: "https://alice.example/",
      photo: null,
    });
  });
});
