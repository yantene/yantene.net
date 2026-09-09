import { describe, expect, it } from "vitest";
import {
  InvalidWebmentionUrlError,
  SameSourceAndTargetError,
  SelfMentionNotAcceptedError,
  TargetNotOnThisSiteError,
} from "./errors";
import { WebmentionRequest } from "./webmention-request.vo";

const SITE_ORIGIN = "https://yantene.net";

function create(source: unknown, target: unknown): WebmentionRequest {
  return WebmentionRequest.create({ source, target, siteOrigin: SITE_ORIGIN });
}

describe("WebmentionRequest", () => {
  it("ノート宛の mention を受け入れ、スラグを取り出す", () => {
    const request = create("https://example.com/post", "https://yantene.net/articles/hello");

    expect(request.source.toString()).toBe("https://example.com/post");
    expect(request.targetSlug.toString()).toBe("hello");
  });

  /*
   * 送り手の書いた表記ではなく、スラグから組み直した URL を持つ。末尾のスラッシュや
   * クエリの有無でリンクの照合が揺れないようにするため。
   */
  it("target はスラグから組み直した正規の URL になる", () => {
    const request = create(
      "https://example.com/post",
      "https://yantene.net/articles/hello/?utm_source=x",
    );

    expect(request.target.toString()).toBe("https://yantene.net/articles/hello");
  });

  it.each([
    ["source", undefined, "https://yantene.net/articles/hello"],
    ["source", "", "https://yantene.net/articles/hello"],
    ["source", "not a url", "https://yantene.net/articles/hello"],
    ["source", "ftp://example.com/x", "https://yantene.net/articles/hello"],
    ["target", "https://example.com/post", undefined],
    ["target", "https://example.com/post", ""],
    ["target", "https://example.com/post", "nope"],
  ])("%s が URL でなければ断る", (_field, source, target) => {
    expect(() => create(source, target)).toThrow(InvalidWebmentionUrlError);
  });

  it("source と target が同じなら断る", () => {
    expect(() =>
      create("https://yantene.net/articles/hello", "https://yantene.net/articles/hello"),
    ).toThrow(SameSourceAndTargetError);
  });

  it.each([
    "https://example.com/articles/hello",
    "https://yantene.net/",
    "https://yantene.net/articles",
    "https://yantene.net/articles/hello/extra",
    "https://yantene.net/articles/Invalid_Slug",
  ])("このサイトの記事 URL でない target は断る (%s)", (target) => {
    expect(() => create("https://example.com/post", target)).toThrow(TargetNotOnThisSiteError);
  });

  /*
   * 記事を `/notes/<slug>` と呼んでいた頃の URL (ADR 0032)。そこから移した記事に限って
   * 旧 URL 宛ても受け、target は送り手の書いた接頭辞のまま組み直す。送り手のページに
   * 書かれているのは旧 URL なので、正規の `/articles/` に直すとリンクの照合で必ず落ちる。
   */
  describe("改名前の /notes/<slug> 宛て", () => {
    it("移した記事なら受け入れ、target は旧 URL のまま組み直す", () => {
      const request = create(
        "https://example.com/post",
        "https://yantene.net/notes/back-from-times/?utm_source=x",
      );

      expect(request.targetSlug.toString()).toBe("back-from-times");
      expect(request.target.toString()).toBe("https://yantene.net/notes/back-from-times");
    });

    // `/notes/` は短文の投稿に譲る場所。移していない記事のスラグを `/notes/` の下で
    // 受けると、そちらの識別子と取り違える余地ができる。
    it.each([
      "https://yantene.net/notes/hacku-2016",
      "https://yantene.net/notes/hello",
      "https://yantene.net/notes",
      "https://yantene.net/notes/back-from-times/extra",
    ])("移していない記事や記事でないものは断る (%s)", (target) => {
      expect(() => create("https://example.com/post", target)).toThrow(TargetNotOnThisSiteError);
    });
  });

  /* 自分の記事どうしのリンクで勝手に増えても、読み手にとっての意味が無い。 */
  it("自サイトからの mention は断る", () => {
    expect(() =>
      create("https://yantene.net/articles/other", "https://yantene.net/articles/hello"),
    ).toThrow(SelfMentionNotAcceptedError);
  });

  // http にしても抜けられないことが以下の眼目。https に直すと確かめたいものが消える

  /*
   * 判定はホスト名なので、スキームや港を変えても抜けられない。origin で見ると
   * `http://` にするだけでここを通り、記事ページは自分自身への canonical リンクを
   * 出しているので、その先のリンクの検証まで通ってしまう (source はクエリで幾らでも
   * 変えられるため、自分の名前の行を好きなだけ積める)。
   */
  it.each([
    ["同じ記事", "http://yantene.net/articles/hello"],
    ["別の記事", "http://yantene.net/articles/other"],
    ["クエリ違い", "http://yantene.net/articles/hello?x=1"],
    ["港違い", "https://yantene.net:8443/articles/other"],
  ])("スキームや港を変えた自サイトからの mention も断る (%s)", (_case, source) => {
    expect(() => create(source, "https://yantene.net/articles/hello")).toThrow(
      SelfMentionNotAcceptedError,
    );
  });

  /* 断るのはホスト名が一致するときだけ。他所からの mention は http でも受け取る。 */
  it("他所のサイトからの mention は http でも受け入れる", () => {
    const request = create("http://example.com/post", "https://yantene.net/articles/hello");

    expect(request.source.toString()).toBe("http://example.com/post");
    expect(request.targetSlug.toString()).toBe("hello");
  });
});
