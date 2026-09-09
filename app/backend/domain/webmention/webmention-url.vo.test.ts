import { describe, expect, it } from "vitest";
import { InvalidWebmentionUrlError } from "./errors";
import { WebmentionUrl } from "./webmention-url.vo";

describe("WebmentionUrl", () => {
  it("絶対 URL を正規化して受け入れる", () => {
    expect(WebmentionUrl.create("HTTPS://Example.com/Post").toString()).toBe(
      "https://example.com/Post",
    );
  });

  /*
   * 素片はサーバーに送られないので、`#1` から `#9999` まで並べても相手が返す文書は同じ。
   * 残すと「別の source」として何行でも積めてしまう (source は行の一意キーの一部)。
   */
  it("素片は落とす", () => {
    expect(WebmentionUrl.create("https://example.com/x#a").toString()).toBe(
      "https://example.com/x",
    );
    expect(WebmentionUrl.create("https://example.com/x?q=1#a").toString()).toBe(
      "https://example.com/x?q=1",
    );
  });

  /* クエリは残す。`?p=123` のような形で記事を分ける相手がいる。 */
  it("クエリは残す", () => {
    expect(WebmentionUrl.create("https://example.com/?p=123").toString()).toBe(
      "https://example.com/?p=123",
    );
  });

  it("前後の空白は落とす", () => {
    expect(WebmentionUrl.create("  https://example.com/  ").toString()).toBe(
      "https://example.com/",
    );
  });

  it.each(["", " ".repeat(3), "not a url", "/articles/hello", "example.com/post"])(
    "URL として読めない値は断る (%s)",
    (raw) => {
      expect(() => WebmentionUrl.create(raw)).toThrow(InvalidWebmentionUrlError);
    },
  );

  /*
   * http / https 以外を通すと、`javascript:` や `data:` を著者の URL として保存し、
   * 表示するときにそのままリンクにしてしまう。入口で止める。
   */
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://example.com/x",
    "mailto:someone@example.com",
  ])("http / https 以外のスキームは断る (%s)", (raw) => {
    expect(() => WebmentionUrl.create(raw)).toThrow(InvalidWebmentionUrlError);
  });

  it("長すぎる URL は断る", () => {
    const raw = `https://example.com/${"a".repeat(2000)}`;

    expect(() => WebmentionUrl.create(raw)).toThrow(InvalidWebmentionUrlError);
  });

  describe("parse", () => {
    it("読めなければ undefined を返す", () => {
      expect(WebmentionUrl.parse("nope")).toBeUndefined();
      expect(WebmentionUrl.parse(null)).toBeUndefined();
      expect(WebmentionUrl.parse(undefined)).toBeUndefined();
    });

    it("読めれば VO を返す", () => {
      expect(WebmentionUrl.parse("https://example.com/x")?.toString()).toBe(
        "https://example.com/x",
      );
    });
  });

  describe("pointsToSameDocument", () => {
    const target = WebmentionUrl.create("https://yantene.net/articles/hello");

    /* 計測用のクエリや見出しへの素片でリンクを見失わないこと。 */
    it.each([
      "https://yantene.net/articles/hello",
      "https://yantene.net/articles/hello/",
      "https://yantene.net/articles/hello?utm_source=x",
      "https://yantene.net/articles/hello#section",
    ])("クエリ・素片・末尾のスラッシュは無視する (%s)", (raw) => {
      expect(WebmentionUrl.create(raw).pointsToSameDocument(target)).toBe(true);
    });

    // 送り先が違えば別。ホストが同じでも、スキームや港が違えば別の資源になる。
    it.each([
      "https://yantene.net/articles/hello-world",
      "https://yantene.net/articles",
      "https://yantene.net:8443/articles/hello",
      "https://example.com/articles/hello",
    ])("別の資源は別として扱う (%s)", (raw) => {
      expect(WebmentionUrl.create(raw).pointsToSameDocument(target)).toBe(false);
    });
  });
});
