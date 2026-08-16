import { describe, expect, it } from "vitest";
import { isHttpUrl, withLowercaseScheme } from "~/lib/http-url";

describe("isHttpUrl", () => {
  // eslint-disable-next-line unicorn/prefer-https -- http と https の両方を通すことが眼目
  it.each(["http://example.com/", "https://example.com/a?b=1#c"])(
    "http(s) は通す (%s)",
    (url) => {
      expect(isHttpUrl(url)).toBe(true);
    },
  );

  /*
   * ブラウザはこれを普通に開く。startsWith で書いていたときは取り逃していて、
   * よそのサイトへ出るのに rel も target も付かなかった (#306)。
   */
  it.each(["HTTPS://example.com/", "HtTp://example.com/"])(
    "スキームの大小は問わない (%s)",
    (url) => {
      expect(isHttpUrl(url)).toBe(true);
    },
  );

  it.each([
    "mailto:a@example.com",
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,<b>",
    "/notes/x",
    "./a.png",
    "#top",
    "",
    "ただの文字列",
  ])("http(s) でないものは通さない (%s)", (url) => {
    expect(isHttpUrl(url)).toBe(false);
  });

  /*
   * プロトコル相対は、単体では基準が無いので読めない。文書の中では現在のスキームが
   * 補われるが、その判断は「別タブで開くか」の側 (isExternalHref) が持つ。
   */
  it("プロトコル相対は通さない", () => {
    expect(isHttpUrl("//example.com/")).toBe(false);
  });
});

/*
 * sanitize は許すスキームを大小を区別する完全一致で照合する。揃えずに渡すと
 * `HTTPS://example.com/` は href ごと落ちて、押せない文字列になる (#306)。
 */
describe("withLowercaseScheme", () => {
  /* eslint-disable unicorn/prefer-https -- 大小を揃えるだけで、スキームを変えないことが眼目。https に直すと確かめたいものが消える */
  it.each([
    ["HTTPS://example.com/", "https://example.com/"],
    ["HtTp://Example.COM/Path", "http://Example.COM/Path"],
    ["MAILTO:a@example.com", "mailto:a@example.com"],
  ])("%s → %s", (input, expected) => {
    expect(withLowercaseScheme(input)).toBe(expected);
  });
  /* eslint-enable unicorn/prefer-https */

  /* スキームより後ろは触らない。パスは大小を区別する。 */
  it("スキームだけを小文字にする", () => {
    expect(withLowercaseScheme("HTTPS://example.com/A/B.PNG")).toBe(
      "https://example.com/A/B.PNG",
    );
  });

  it.each(["/notes/X", "#Top", "./A.png", "//Example.com/", ""])(
    "スキームが無ければ触らない (%s)",
    (url) => {
      expect(withLowercaseScheme(url)).toBe(url);
    },
  );
});
