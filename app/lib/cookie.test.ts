import { describe, expect, it } from "vitest";
import { readCookieValues } from "./cookie";

describe("readCookieValues", () => {
  it("名前の一致する値を返す", () => {
    expect(readCookieValues("locale=ja", "locale")).toEqual(["ja"]);
  });

  it("並んだ中から拾う", () => {
    expect(readCookieValues("a=1; locale=ja; b=2", "locale")).toEqual(["ja"]);
  });

  it("前後の空白を落とす", () => {
    expect(readCookieValues("  locale = ja  ", "locale")).toEqual(["ja"]);
  });

  it("無ければ空", () => {
    expect(readCookieValues("a=1", "locale")).toEqual([]);
    expect(readCookieValues(null, "locale")).toEqual([]);
    expect(readCookieValues("", "locale")).toEqual([]);
  });

  it("名前の一部が一致するだけのものは拾わない", () => {
    expect(readCookieValues("xlocale=ja; locales=en", "locale")).toEqual([]);
  });

  /*
   * ドメインやパスの違う cookie が両方送られてくると、同じ名前が並ぶ。どれを採るかは
   * 呼ぶ側が決めるので、ここでは書かれた順に全部返す (#313)。
   */
  it("同じ名前が並んでいたら書かれた順に全部返す", () => {
    expect(readCookieValues("locale=%; locale=ja", "locale")).toEqual(["%", "ja"]);
  });

  /*
   * 解いていたときは `Cookie: locale=%` を送るだけで、その相手にはサイトの全ページが
   * 500 になっていた (#309)。cookie は消すまで送られ続けるので開けなくなる。
   */
  it("百分率符号化を解かない", () => {
    expect(readCookieValues("locale=%", "locale")).toEqual(["%"]);
    expect(readCookieValues("locale=%E3%81%82", "locale")).toEqual(["%E3%81%82"]);
  });

  it("値に = が入っていても切らない", () => {
    expect(readCookieValues("t=a=b=c", "t")).toEqual(["a=b=c"]);
  });

  it("空の値も値として返す", () => {
    expect(readCookieValues("locale=", "locale")).toEqual([""]);
  });

  /* 名前だけの切れ端は cookie ではない。値 "" として拾うと呼ぶ側が誤読する。 */
  it("= の無い切れ端は拾わない", () => {
    expect(readCookieValues("locale", "locale")).toEqual([]);
    expect(readCookieValues("locale; locale=ja", "locale")).toEqual(["ja"]);
  });
});
